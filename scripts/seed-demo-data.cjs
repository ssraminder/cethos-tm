// Seed a demo TM, termbase, and job so screenshots / training docs have
// realistic-looking content. Idempotent: removes prior demo rows first.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { XMLParser } = require("fast-xml-parser");

function loadEnv() {
  const text = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", parseTagValue: false, trimValues: false });
function asArray(v) { return v == null ? [] : Array.isArray(v) ? v : [v]; }
function pickText(v) { if (typeof v === "string") return v; if (v && typeof v === "object" && typeof v["#text"] === "string") return v["#text"]; return ""; }

function parseTmxUnits(buf) {
  const root = parser.parse(buf.toString("utf8"));
  const units = [];
  for (const tu of asArray(root.tmx?.body?.tu)) {
    let s, t;
    for (const tuv of asArray(tu.tuv)) {
      const lang = (tuv["@_xml:lang"] ?? tuv["@_lang"] ?? "").toLowerCase();
      if (lang.startsWith("en")) s = pickText(tuv.seg).trim();
      else if (lang.startsWith("fr")) t = pickText(tuv.seg).trim();
    }
    if (s && t) units.push({ source_text: s, target_text: t });
  }
  return units;
}

function parseTbxConcepts(buf) {
  const root = parser.parse(buf.toString("utf8"));
  const body = root.martif?.text?.body ?? root.martif?.body;
  const concepts = [];
  for (const e of asArray(body?.termEntry)) {
    const concept = { domain: null, terms: [] };
    for (const d of asArray(e.descrip)) {
      const type = d["@_type"];
      if (type === "domain") concept.domain = pickText(d);
    }
    for (const ls of asArray(e.langSet ?? e.langSec)) {
      const lang = ls["@_xml:lang"] ?? ls["@_lang"];
      if (!lang) continue;
      for (const tig of asArray(ls.tig)) {
        const term = pickText(tig.term).trim();
        if (!term) continue;
        let status = "approved";
        for (const a of asArray(tig.admin)) {
          const t = (typeof a === "object" ? pickText(a) : "").toLowerCase();
          if (t.includes("forbid") || t.includes("deprecat")) status = "forbidden";
        }
        concept.terms.push({ language: lang, term, status });
      }
    }
    if (concept.terms.length) concepts.push(concept);
  }
  return concepts;
}

async function main() {
  loadEnv();
  const { createClient } = require("@supabase/supabase-js");
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Find admin + translator
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  const admin = (list?.users ?? []).find((u) => u.email?.toLowerCase() === "raminder@cethos.com");
  const translator = (list?.users ?? []).find((u) => u.email?.toLowerCase() === "ss.raminder@gmail.com");
  if (!admin) { console.error("admin not found, run create-users.cjs"); process.exit(1); }

  // 1) TM
  console.log("Seeding TM…");
  await svc.from("translation_memories").delete().eq("name", "Acme Marketing EN→FR");
  const { data: tm } = await svc.from("translation_memories").insert({
    name: "Acme Marketing EN→FR",
    description: "Marketing & brand voice translations for Acme Corporation.",
    source_lang: "en-US",
    target_lang: "fr-FR",
    scope: "client",
    created_by: admin.id,
  }).select("id").single();
  const tmxBuf = fs.readFileSync(path.join(__dirname, "..", "smoke", "sample.tmx"));
  const tmxUnits = parseTmxUnits(tmxBuf);
  await svc.from("tm_units").insert(tmxUnits.map((u) => ({
    tm_id: tm.id, source_text: u.source_text, target_text: u.target_text,
    source_hash: "placeholder-trigger-overrides", quality_score: 5,
  })));
  console.log(`  TM created with ${tmxUnits.length} units`);

  // 2) Termbase
  console.log("Seeding termbase…");
  await svc.from("termbases").delete().eq("name", "Acme Brand Glossary");
  const { data: tb } = await svc.from("termbases").insert({
    name: "Acme Brand Glossary",
    description: "Approved + forbidden terms for the Acme brand voice.",
    languages: ["en-US", "fr-FR"],
    scope: "client",
    created_by: admin.id,
  }).select("id").single();
  const tbxBuf = fs.readFileSync(path.join(__dirname, "..", "smoke", "sample.tbx"));
  const concepts = parseTbxConcepts(tbxBuf);
  for (const c of concepts) {
    const { data: cn } = await svc.from("term_concepts").insert({ termbase_id: tb.id, domain: c.domain }).select("id").single();
    for (const t of c.terms) {
      await svc.from("term_entries").insert({
        concept_id: cn.id, language: t.language, term: t.term, status: t.status,
      });
    }
  }
  console.log(`  Termbase created with ${concepts.length} concepts`);

  // 3) Demo job assigned to translator (or unassigned if not yet provisioned)
  console.log("Seeding demo job…");
  await svc.from("jobs").delete().eq("reference", "DEMO-Q2-MKT");
  const { data: job } = await svc.from("jobs").insert({
    reference: "DEMO-Q2-MKT",
    source: "manual",
    source_lang: "en-US",
    target_lang: "fr-FR",
    status: translator ? "in_progress" : "draft",
    source_filename: "q2-marketing.txt",
    source_format: "txt",
    word_count: 36,
    segment_count: 5,
    created_by: admin.id,
    assigned_to: translator?.id ?? null,
    deadline: new Date(Date.now() + 4 * 86400_000).toISOString(),
  }).select("id").single();

  function normalize(s) { return s.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase(); }
  function hash(s) { return crypto.createHash("sha256").update(normalize(s)).digest("hex"); }

  const segs = [
    { source_text: "Welcome to Acme Corporation.",         target_text: "Bienvenue chez Acme Corporation.",  status: "translated" },
    { source_text: "Hello, world.",                        target_text: "Bonjour, le monde.",                status: "translated" },
    { source_text: "Our customer-first values guide us.",  target_text: "Nos valeurs centrées client nous guident.", status: "draft" },
    { source_text: "Save the file before closing.",        target_text: "",                                  status: "untranslated" },
    { source_text: "Don't say cheap; say affordable.",     target_text: "",                                  status: "untranslated" },
  ];
  await svc.from("segments").insert(segs.map((s, i) => ({
    job_id: job.id, seq: i + 1,
    source_text: s.source_text,
    source_hash: hash(s.source_text),
    word_count: s.source_text.split(/\s+/).length,
    target_text: s.target_text,
    status: s.status,
    confirmed_by: s.status === "translated" ? (translator?.id ?? admin.id) : null,
    confirmed_at: s.status === "translated" ? new Date().toISOString() : null,
  })));
  await svc.from("job_resources").insert([
    { job_id: job.id, resource_type: "tm", resource_id: tm.id, priority: 100 },
    { job_id: job.id, resource_type: "termbase", resource_id: tb.id, priority: 100 },
  ]);
  console.log(`  Job ${job.id} (DEMO-Q2-MKT) created with 5 segments`);

  // 4) Mint a sample API key for the integrations screenshot
  console.log("Seeding API key…");
  const { mintApiKey } = await (async () => {
    const random = crypto.randomBytes(24).toString("hex");
    const plaintext = `cethos_tms_${random}`;
    const prefix = plaintext.slice(0, 8);
    const keyHash = crypto.createHash("sha256").update(`${process.env.APP_SECRET}:${plaintext}`).digest("hex");
    await svc.from("api_keys").delete().eq("name", "Acme TMS Integration (demo)");
    await svc.from("api_keys").insert({
      name: "Acme TMS Integration (demo)",
      scope: "tms_ingest",
      key_prefix: prefix,
      key_hash: keyHash,
      created_by: admin.id,
    });
    return { plaintext };
  })();

  // 5) Some audit events
  console.log("Seeding audit events…");
  await svc.from("audit_log").insert([
    { actor_id: admin.id, actor_email: "raminder@cethos.com", category: "auth", action: "sign_in_completed", ip_address: "203.0.113.10" },
    { actor_id: admin.id, actor_email: "raminder@cethos.com", category: "tm", action: "tm_created", target_type: "tm", target_id: tm.id, meta: { name: "Acme Marketing EN→FR" } },
    { actor_id: admin.id, actor_email: "raminder@cethos.com", category: "termbase", action: "termbase_created", target_type: "termbase", target_id: tb.id, meta: { name: "Acme Brand Glossary" } },
    { actor_id: admin.id, actor_email: "raminder@cethos.com", category: "job", action: "job_created_manual", target_type: "job", target_id: job.id, meta: { reference: "DEMO-Q2-MKT" } },
  ]);

  console.log("\nDONE ✓");
}
main().catch((e) => { console.error(e); process.exit(1); });
