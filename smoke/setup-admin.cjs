// Create the smoke admin user via the Supabase admin API (proper way).
const fs = require("node:fs");
const path = require("node:path");

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
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const email = "smoke@cethos.com";
  const password = "CethosCAT-Smoke!";

  // Tear down any prior state.
  console.log("Cleaning prior smoke admin (if any)…");
  await svc.from("profiles").delete().eq("email", email);
  // Find by email and remove via admin
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  for (const u of list?.users ?? []) {
    if (u.email?.toLowerCase() === email) {
      console.log("  removing existing auth user:", u.id);
      await svc.auth.admin.deleteUser(u.id);
    }
  }

  // Create via admin API
  console.log("Creating via admin API…");
  const { data: created, error: createErr } = await svc.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: "Smoke Admin", role: "admin" },
    app_metadata: { provider: "email", providers: ["email"], role: "admin", auth_source: "email" },
  });
  if (createErr) { console.error("createUser failed:", createErr.message); process.exit(1); }
  console.log("  user.id:", created.user.id);

  const { error: profErr } = await svc.from("profiles").insert({
    id: created.user.id,
    email,
    full_name: "Smoke Admin",
    role: "admin",
    status: "active",
    auth_source: "email",
    mfa_required: true,
  });
  if (profErr) { console.error("profile insert failed:", profErr.message); process.exit(1); }
  console.log("Profile created.");

  console.log("\nReady. Use:");
  console.log("  email:    smoke@cethos.com");
  console.log("  password: CethosCAT-Smoke!");
}
main().catch((e) => { console.error(e); process.exit(1); });
