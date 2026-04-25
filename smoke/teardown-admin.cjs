// Remove the smoke admin user. Run when you're done testing.
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
  await svc.from("profiles").delete().eq("email", email);
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  for (const u of list?.users ?? []) {
    if (u.email?.toLowerCase() === email) {
      await svc.auth.admin.deleteUser(u.id);
      console.log("removed", u.id);
    }
  }
  await svc.from("email_otps").delete().eq("email", email);
  console.log("done");
}
main().catch((e) => { console.error(e); process.exit(1); });
