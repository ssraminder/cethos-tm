// Insert a sign-in OTP with a known plaintext value into email_otps so the
// user can log in without depending on Mailgun delivery to a domain whose
// inbox they don't yet read.
//
// Usage:
//   node scripts/issue-test-otp.cjs [email] [code]
//
// Defaults: email=raminder@cethos.com, code=111111 (10-min expiry, 5 attempts)

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function loadEnv() {
  const text = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  loadEnv();
  const email = (process.argv[2] || "raminder@cethos.com").toLowerCase();
  const code = process.argv[3] || "111111";
  if (!/^\d{6}$/.test(code)) {
    console.error("Code must be exactly 6 digits.");
    process.exit(1);
  }

  const { createClient } = require("@supabase/supabase-js");
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile } = await svc.from("profiles").select("id").eq("email", email).maybeSingle();
  const userId = profile?.id ?? null;

  // Mark any existing pending OTP for this email+purpose as consumed.
  await svc.from("email_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("email", email).eq("purpose", "signin_mfa")
    .is("consumed_at", null);

  const salt = crypto.randomBytes(16).toString("hex");
  const codeHash = crypto.createHmac("sha256", process.env.APP_SECRET).update(`${salt}:${code}`).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

  const { data: row, error } = await svc.from("email_otps").insert({
    email,
    purpose: "signin_mfa",
    user_id: userId,
    code_hash: codeHash,
    salt,
    expires_at: expiresAt,
    max_attempts: 5,
  }).select("id, expires_at").single();

  if (error) {
    console.error("Insert failed:", error.message);
    process.exit(1);
  }

  console.log("\nOTP issued ✓");
  console.log(`  email:      ${email}`);
  console.log(`  code:       ${code}`);
  console.log(`  expires at: ${row.expires_at}`);
  console.log(`  otp id:     ${row.id}`);
  console.log("\nTo use it:");
  console.log("  1. Go to /sign-in, enter your email + password");
  console.log("  2. On /verify, type the 6-digit code above");
  console.log("\nNote: also issuing a real OTP via Mailgun on the password-submit");
  console.log("step will invalidate this one. If you press Sign in, run this");
  console.log("script AFTER you reach /verify.");
}
main().catch((e) => { console.error(e); process.exit(1); });
