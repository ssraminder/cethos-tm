// Create three real users with known passwords. Profiles are inserted with
// the right role and active status. MFA (OTP) is required for all of them.
const fs = require("node:fs");
const path = require("node:path");

function loadEnv() {
  const text = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const USERS = [
  { email: "raminder@cethos.com",     full_name: "Raminder Shah",  role: "admin",      password: "Cethos-Admin-2026!" },
  { email: "pm@cethoscorp.com",       full_name: "Cethos PM",      role: "pm",         password: "Cethos-PM-2026!" },
  { email: "ss.raminder@gmail.com",   full_name: "Raminder (Translator)", role: "translator", password: "Cethos-Trans-2026!" },
];

async function main() {
  loadEnv();
  const { createClient } = require("@supabase/supabase-js");
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Get existing list once to find dups
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  const byEmail = new Map((list?.users ?? []).map((u) => [u.email?.toLowerCase(), u]));

  for (const u of USERS) {
    console.log(`\n→ ${u.email}  (${u.role})`);
    const existing = byEmail.get(u.email.toLowerCase());
    if (existing) {
      console.log(`   removing existing auth user ${existing.id}`);
      await svc.from("profiles").delete().eq("id", existing.id);
      await svc.auth.admin.deleteUser(existing.id);
    } else {
      // Profile may exist orphaned (without auth user) — clean
      await svc.from("profiles").delete().eq("email", u.email);
    }

    const { data: created, error } = await svc.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name, role: u.role },
      app_metadata: { provider: "email", providers: ["email"], role: u.role, auth_source: "email" },
    });
    if (error) { console.error(`   FAIL: ${error.message}`); continue; }

    const { error: profErr } = await svc.from("profiles").insert({
      id: created.user.id,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      status: "active",
      auth_source: "email",
      mfa_required: true,
    });
    if (profErr) { console.error(`   profile FAIL: ${profErr.message}`); continue; }

    console.log(`   id: ${created.user.id}`);
    console.log(`   password: ${u.password}`);
  }

  console.log("\nALL USERS PROVISIONED ✓");
  console.log("\nReminder: each sign-in sends a 6-digit OTP via Mailgun (reply.cethos.com).");
  console.log("Make sure raminder@cethos.com and pm@cethoscorp.com have working inboxes,");
  console.log("or you'll be stuck at /verify after the password step.");
}
main().catch((e) => { console.error(e); process.exit(1); });
