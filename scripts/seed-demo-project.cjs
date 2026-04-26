// Seed a demo project, attach the demo job to it, assign one PM and pre-approve
// the smoke translator. Idempotent.
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

  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  const find = (e) => (list?.users ?? []).find((u) => u.email?.toLowerCase() === e.toLowerCase());
  const admin = find("raminder@cethos.com");
  const pm = find("pm@cethoscorp.com");
  const translator = find("ss.raminder@gmail.com");
  if (!admin || !pm || !translator) { console.error("Provision users first via smoke/create-users.cjs"); process.exit(1); }

  await svc.from("projects").delete().eq("reference", "ACME-Q2-MKT");

  const { data: project, error } = await svc.from("projects").insert({
    name: "Acme Q2 Marketing Localization",
    reference: "ACME-Q2-MKT",
    description: "Quarterly product-marketing rollout for the EMEA region.\nFrench first; Spanish/German to follow.",
    status: "active",
    deadline: new Date(Date.now() + 14 * 86400_000).toISOString(),
    created_by: admin.id,
  }).select("id").single();
  if (error) { console.error(error.message); process.exit(1); }

  await svc.from("project_pms").insert({ project_id: project.id, pm_id: pm.id });
  await svc.from("project_vendors").insert({ project_id: project.id, vendor_id: translator.id });

  // Attach the existing demo job to this project (if it exists).
  await svc.from("jobs").update({ project_id: project.id }).eq("reference", "DEMO-Q2-MKT");

  console.log("Project seeded:");
  console.log("  id:        ", project.id);
  console.log("  name:      ", "Acme Q2 Marketing Localization");
  console.log("  PM:        ", pm.email, "(explicit)");
  console.log("  vendor:    ", translator.email);
  console.log("  job linked:", "DEMO-Q2-MKT");
}
main().catch((e) => { console.error(e); process.exit(1); });
