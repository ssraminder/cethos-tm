// Full auth smoke: validates the same code path the sign-in action uses.
// 1. signInWithPassword against Supabase (proves the user + password work)
// 2. Look up profile (proves profile + role pipeline)
// 3. Issue OTP and send via Mailgun (proves the second factor works end-to-end)
//
// Usage: node smoke/auth-flow.cjs

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const FormData = require("form-data");

function loadEnv() {
  const text = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  loadEnv();

  const { createClient } = require("@supabase/supabase-js");
  const Mailgun = require("mailgun.js");

  const SUP_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUP_URL || !PUB || !SVC) throw new Error("Supabase env not set");

  const email = "smoke@cethos.com";
  const password = "CethosCAT-Smoke!";

  // 1) signInWithPassword via the public client (this is what our action does).
  console.log("1) signInWithPassword…");
  const pub = createClient(SUP_URL, PUB, { auth: { persistSession: false } });
  const { data: signin, error: signErr } = await pub.auth.signInWithPassword({ email, password });
  if (signErr) {
    console.error("  FAIL:", signErr.message);
    process.exit(1);
  }
  console.log("  OK — user.id:", signin.user.id, "session?", !!signin.session);

  // Sign out immediately — we don't want to persist the supabase session here;
  // the OTP step is the gate. (The action lives on the server; this is just a smoke.)
  await pub.auth.signOut();

  // 2) Look up profile via service role.
  console.log("2) profile lookup…");
  const svc = createClient(SUP_URL, SVC, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profErr } = await svc
    .from("profiles")
    .select("id, role, status, mfa_required, full_name")
    .eq("id", signin.user.id)
    .maybeSingle();
  if (profErr || !profile) { console.error("  FAIL:", profErr?.message); process.exit(1); }
  console.log("  OK —", JSON.stringify(profile));
  if (profile.status !== "active") { console.error("  FAIL: profile not active"); process.exit(1); }

  // 3) Issue OTP (mirror our otp.ts logic), insert row, send email.
  console.log("3) issue OTP + send via Mailgun…");
  const code = String(crypto.randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0");
  const salt = crypto.randomBytes(16).toString("hex");
  const codeHash = crypto.createHmac("sha256", process.env.APP_SECRET || "dev").update(`${salt}:${code}`).digest("hex");

  // Invalidate any in-flight OTP for this email+purpose
  await svc.from("email_otps").update({ consumed_at: new Date().toISOString() })
    .eq("email", email).eq("purpose", "signin_mfa").is("consumed_at", null);

  const { data: otpRow, error: otpErr } = await svc.from("email_otps").insert({
    email, purpose: "signin_mfa", user_id: profile.id,
    code_hash: codeHash, salt,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    max_attempts: 5,
  }).select("id").single();
  if (otpErr) { console.error("  FAIL: otp insert:", otpErr.message); process.exit(1); }
  console.log("  OTP row:", otpRow.id, "code(plaintext-for-test):", code);

  const region = (process.env.MAILGUN_REGION || "us").toLowerCase();
  const url = region === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";
  const mg = new Mailgun(FormData).client({
    username: "api", key: process.env.MAILGUN_API_KEY, url,
  });

  const subject = `Your Cethos CAT code: ${code}`;
  const text = `Your sign-in verification code is:\n\n  ${code}\n\nExpires in 10 minutes.`;
  const res = await mg.messages.create(process.env.MAILGUN_DOMAIN, {
    from: process.env.MAILGUN_FROM_EMAIL,
    to: email,
    subject, text,
  });
  console.log("  Mailgun:", JSON.stringify(res));

  // 4) Verify path: load the OTP row by hash and confirm equality.
  console.log("4) verify OTP path…");
  const { data: rows } = await svc.from("email_otps")
    .select("*").eq("email", email).eq("purpose", "signin_mfa")
    .is("consumed_at", null).order("created_at", { ascending: false }).limit(1);
  if (!rows || !rows.length) { console.error("  FAIL: OTP row not retrievable"); process.exit(1); }
  const row = rows[0];
  const provided = crypto.createHmac("sha256", process.env.APP_SECRET || "dev").update(`${row.salt}:${code}`).digest("hex");
  const equal = provided === row.code_hash;
  console.log("  hash match:", equal);
  if (!equal) process.exit(1);

  // Mark consumed
  await svc.from("email_otps").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
  console.log("\nALL CHECKS PASSED ✓");
}
main().catch((e) => { console.error("THROWN:", e.message, e); process.exit(1); });
