// Termbase smoke: parse TBX → insert → run find_term_hits_for_job.
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

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", parseTagValue: false, trimValues: true });

function asArray(v) { return v === undefined ? [] : Array.isArray(v) ? v : [v]; }
function pickText(v) { if (typeof v === "string") return v; if (v && typeof v === "object" && typeof v["#text"] === "string") return v["#text"]; return ""; }
function statusFromAdmin(node) {
  for (const a of asArray(node?.admin)) {
    const text = (typeof a === "object" ? pickText(a) : "").toLowerCase();
    if (text.includes("forbid") || text.includes("deprecat")) return "forbidden";
    if (text.includes("preferr") || text.includes("approv") || text.includes("standard")) return "approved";
  }
  return undefined;
}
function parseTbx(buf) {
  const root = parser.parse(buf.toString("utf8"));
  const body = root.martif?.text?.body ?? root.martif?.body ?? root.tbx?.text?.body ?? root.tbx?.body;
  const entries = asArray(body?.termEntry ?? body?.conceptEntry);
  const concepts = [];
  for (const e of entries) {
    const concept = { terms: [] };
    for (const ls of asArray(e.langSet ?? e.langSec)) {
      const lang = ls["@_xml:lang"] ?? ls["@_lang"];
      if (!lang) continue;
      const tigs = [...asArray(ls.tig), ...asArray(ls.termSec), ...asArray(ls.ntig)];
      for (const tig of tigs) {
        const term = pickText(tig.term).trim();
        if (!term) continue;
        concept.terms.push({ language: lang, term, status: statusFromAdmin(tig) });
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

  // Cleanup
  await svc.from("termbases").delete().eq("name", "Smoke Brand TB");
  await svc.from("jobs").delete().eq("reference", "J-SMOKE-TB");

  const buf = fs.readFileSync(path.join(__dirname, "sample.tbx"));
  const concepts = parseTbx(buf);
  console.log("Parsed concepts:", concepts.length);
  if (concepts.length !== 3) { console.error("FAIL"); process.exit(1); }

  const { data: tb } = await svc.from("termbases").insert({
    name: "Smoke Brand TB", languages: ["en-US", "fr-FR"], scope: "global",
  }).select("id").single();

  for (const c of concepts) {
    const { data: cn } = await svc.from("term_concepts").insert({ termbase_id: tb.id }).select("id").single();
    for (const t of c.terms) {
      await svc.from("term_entries").insert({
        concept_id: cn.id, language: t.language, term: t.term,
        status: t.status ?? "approved",
      });
    }
  }
  console.log("Inserted concepts + entries.");

  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  const admin = (list.users ?? []).find((u) => u.email?.toLowerCase() === "smoke@cethos.com");
  if (!admin) { console.error("Need smoke admin"); process.exit(1); }

  const segs = [
    "Welcome, valued customer!",
    "Our brand Acme is more than a name.",
    "Don't say cheap; say affordable.",
    "Nothing relevant here.",
  ];
  function normalize(s) { return s.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase(); }
  function hash(s) { return crypto.createHash("sha256").update(normalize(s)).digest("hex"); }

  const { data: job } = await svc.from("jobs").insert({
    reference: "J-SMOKE-TB", source: "manual", source_lang: "en-US", target_lang: "fr-FR",
    status: "draft", source_filename: "x.txt", source_format: "txt",
    word_count: 0, segment_count: segs.length, created_by: admin.id,
  }).select("id").single();
  await svc.from("segments").insert(segs.map((s, i) => ({
    job_id: job.id, seq: i + 1, source_text: s, source_hash: hash(s), word_count: s.split(/\s+/).length,
  })));
  await svc.from("job_resources").insert({ job_id: job.id, resource_type: "termbase", resource_id: tb.id, priority: 100 });

  const { data: hits, error } = await svc.rpc("find_term_hits_for_job", { p_job_id: job.id });
  if (error) { console.error("RPC fail:", error.message); process.exit(1); }
  console.log(`\nTerm hits: ${hits.length}`);
  for (const h of hits) {
    console.log(`  seg ${h.segment_id.slice(0,8)}: "${h.source_term}" (${h.source_status}) → "${h.target_term}" (${h.target_status})`);
  }
  // Expect: customer→client, Acme→Acme, cheap→bon marché (forbidden)
  if (hits.length !== 3) { console.error(`Expected 3 hits, got ${hits.length}`); process.exit(1); }
  const forbidden = hits.find((h) => h.target_status === "forbidden");
  if (!forbidden || forbidden.source_term !== "cheap") { console.error("Forbidden term not detected"); process.exit(1); }

  // Cleanup
  await svc.from("jobs").delete().eq("id", job.id);
  await svc.from("termbases").delete().eq("id", tb.id);

  console.log("\nALL CHECKS PASSED ✓");
}
main().catch((e) => { console.error("THROWN:", e); process.exit(1); });
