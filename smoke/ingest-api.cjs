// TMS ingest API smoke. Mints a key via service role, hits the endpoint
// with a base64'd .txt payload, verifies the response and DB state.
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
  const { createClient } = require("@supabase/supabase-js");
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Need the smoke admin (created earlier).
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  const admin = (list.users ?? []).find((u) => u.email?.toLowerCase() === "smoke@cethos.com");
  if (!admin) { console.error("Run setup-admin.cjs first."); process.exit(1); }

  // Mint a key directly via SQL (mirrors mintApiKey logic).
  const random = crypto.randomBytes(24).toString("hex");
  const plaintext = `cethos_tms_${random}`;
  const prefix = plaintext.slice(0, 8);
  const keyHash = crypto.createHash("sha256")
    .update(`${process.env.APP_SECRET}:${plaintext}`).digest("hex");

  await svc.from("api_keys").delete().eq("name", "Smoke ingest key");
  const { data: keyRow, error: keyErr } = await svc.from("api_keys").insert({
    name: "Smoke ingest key",
    scope: "tms_ingest",
    key_prefix: prefix,
    key_hash: keyHash,
    created_by: admin.id,
  }).select("id").single();
  if (keyErr) { console.error("Mint fail:", keyErr.message); process.exit(1); }
  console.log("Minted key:", plaintext);

  const sample = "Hello from the TMS push API.\n\nThis should produce two segments.";
  const body = {
    source_b64: Buffer.from(sample, "utf8").toString("base64"),
    source_filename: "tms-test.txt",
    source_mime_type: "text/plain",
    source_lang: "en-US",
    target_lang: "fr-FR",
    external_ref: "TMS-99999",
  };

  // Hit the API on the local dev server (port 3000).
  const res = await fetch("http://localhost:3000/api/jobs/ingest", {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${plaintext}` },
    body: JSON.stringify(body),
  });
  const out = await res.json();
  console.log("Status:", res.status);
  console.log("Body:", JSON.stringify(out));

  if (res.status !== 201) { console.error("Expected 201"); process.exit(1); }
  if (!out.job_id) { console.error("No job_id returned"); process.exit(1); }

  // Verify DB state.
  const { data: job } = await svc.from("jobs").select("*").eq("id", out.job_id).maybeSingle();
  const { data: segs } = await svc.from("segments").select("seq, source_text").eq("job_id", out.job_id).order("seq");
  console.log("Job:", job.reference, "source:", job.source, "external_ref:", job.external_ref);
  console.log("Segments:");
  for (const s of segs) console.log(`  ${s.seq}. ${s.source_text}`);
  if (job.source !== "tms_push") { console.error("source should be tms_push"); process.exit(1); }
  if (job.external_ref !== "TMS-99999") { console.error("external_ref mismatch"); process.exit(1); }

  // Negative test: bad token
  const badRes = await fetch("http://localhost:3000/api/jobs/ingest", {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": "Bearer cethos_tms_invalid_token_xxx" },
    body: JSON.stringify(body),
  });
  console.log("Bad-token status:", badRes.status);
  if (badRes.status !== 401) { console.error("Expected 401 for bad key"); process.exit(1); }

  // Cleanup
  await svc.from("jobs").delete().eq("id", out.job_id);
  await svc.from("api_keys").delete().eq("id", keyRow.id);

  console.log("\nALL CHECKS PASSED ✓");
}
main().catch((e) => { console.error("THROWN:", e); process.exit(1); });
