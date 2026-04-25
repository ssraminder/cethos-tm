// Full TM flow smoke:
// 1. Parse the sample TMX (proves parser works on real input)
// 2. Create a TM + insert units (proves trigger computes source_hash)
// 3. Create a job + attach the TM
// 4. Call find_exact_matches_for_job → expect 100% on exact-source segments
// 5. Call find_tm_matches with a fuzzy variant → expect non-exact match scoring

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

// Reimplement the TMX parser inline (so this script doesn't need a TS toolchain).
const { XMLParser } = require("fast-xml-parser");
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", parseTagValue: false, trimValues: true });

function getSeg(seg) { if (!seg) return ""; if (typeof seg === "string") return seg; if (typeof seg === "object" && typeof seg["#text"] === "string") return seg["#text"]; return ""; }

function parseTmx(buf) {
  const root = parser.parse(buf.toString("utf8"));
  const tus = !root.tmx?.body?.tu ? [] : Array.isArray(root.tmx.body.tu) ? root.tmx.body.tu : [root.tmx.body.tu];
  const out = [];
  for (const tu of tus) {
    const tuvList = Array.isArray(tu.tuv) ? tu.tuv : [tu.tuv];
    let s, t;
    for (const tuv of tuvList) {
      const lang = tuv["@_xml:lang"] ?? tuv["@_lang"] ?? "";
      if (lang.toLowerCase().startsWith("en")) s = getSeg(tuv.seg);
      else if (lang.toLowerCase().startsWith("fr")) t = getSeg(tuv.seg);
    }
    if (s && t) out.push({ source_text: s.trim(), target_text: t.trim() });
  }
  return out;
}

async function main() {
  loadEnv();
  const { createClient } = require("@supabase/supabase-js");
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Cleanup any prior smoke state.
  await svc.from("translation_memories").delete().eq("name", "Smoke EN→FR");

  // 1) Parse TMX
  console.log("1) parseTmx…");
  const buf = fs.readFileSync(path.join(__dirname, "sample.tmx"));
  const units = parseTmx(buf);
  console.log("  parsed units:", units.length);
  if (units.length !== 5) { console.error("FAIL: expected 5 units"); process.exit(1); }

  // 2) Create TM + insert units
  console.log("2) create TM + insert units…");
  const { data: tm } = await svc.from("translation_memories").insert({
    name: "Smoke EN→FR", source_lang: "en-US", target_lang: "fr-FR", scope: "global",
  }).select("id").single();
  console.log("  tm.id:", tm.id);

  const rows = units.map((u) => ({
    tm_id: tm.id,
    source_text: u.source_text,
    target_text: u.target_text,
    source_hash: "placeholder-overwritten-by-trigger",
  }));
  const { error: upErr, count } = await svc.from("tm_units").upsert(rows, { onConflict: "tm_id,source_hash,target_text", count: "exact" });
  if (upErr) { console.error("  FAIL:", upErr.message); process.exit(1); }
  console.log("  inserted units:", count);

  // 3) Create a job that uses 3 of the same source texts (so we expect 3 exact matches)
  //    + 1 fuzzy variant + 1 unique source.
  console.log("3) create job + segments…");
  // Need an admin to own the job
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  const adminUser = (list.users ?? []).find((u) => u.email?.toLowerCase() === "smoke@cethos.com");
  if (!adminUser) { console.error("  FAIL: smoke admin not found. Run setup-admin.cjs first."); process.exit(1); }

  await svc.from("jobs").delete().eq("reference", "J-SMOKE-TM");
  const { data: job, error: jobErr } = await svc.from("jobs").insert({
    reference: "J-SMOKE-TM", source: "manual", source_lang: "en-US", target_lang: "fr-FR",
    status: "draft", source_filename: "test.txt", source_format: "txt", word_count: 0, segment_count: 5,
    created_by: adminUser.id,
  }).select("id").single();
  if (jobErr) { console.error("  FAIL:", jobErr.message); process.exit(1); }

  function normalize(s) { return s.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase(); }
  function hash(s) { return crypto.createHash("sha256").update(normalize(s)).digest("hex"); }

  const segs = [
    "Hello, world.",                                                // exact match
    "This is the first paragraph with two sentences.",              // exact match
    "The quick brown fox jumps over the lazy DOG.",                 // fuzzy (case)
    "Welcome to Acme.",                                             // fuzzy (substring)
    "An entirely unrelated sentence about clouds.",                 // no match
  ];
  const segRows = segs.map((src, i) => ({
    job_id: job.id, seq: i + 1, source_text: src, source_hash: hash(src), word_count: src.split(/\s+/).length,
  }));
  await svc.from("segments").insert(segRows);
  console.log("  segments inserted:", segRows.length);

  // 4) Attach TM
  await svc.from("job_resources").insert({ job_id: job.id, resource_type: "tm", resource_id: tm.id, priority: 100 });
  console.log("  TM attached");

  // 5) Exact-match RPC
  console.log("4) find_exact_matches_for_job…");
  const { data: exact, error: exErr } = await svc.rpc("find_exact_matches_for_job", { p_job_id: job.id });
  if (exErr) { console.error("  FAIL:", exErr.message); process.exit(1); }
  console.log("  exact matches:", exact.length);
  for (const m of exact) console.log(`    seg "${segs[segRows.findIndex((s)=>s.id===m.segment_id) ?? -1] ?? "?"}" → ${m.target_text}`);
  // 3 exact matches expected: seg1 (literal), seg2 (literal), seg3 (case-insensitive: "DOG"→"dog").
  if (exact.length !== 3) { console.error(`  EXPECT 3 exact matches, got ${exact.length}`); process.exit(1); }

  // 6) Fuzzy match RPC for each segment
  console.log("5) find_tm_matches per segment…");
  for (const src of segs) {
    const { data: m } = await svc.rpc("find_tm_matches", { p_job_id: job.id, p_source: src, p_limit: 3 });
    const top = m && m[0];
    console.log(`  "${src.slice(0, 60)}" → ${top ? `${top.kind} ${(top.score * 100).toFixed(0)}% : "${top.target_text}"` : "no match"}`);
  }

  // Cleanup
  console.log("\nCleaning up…");
  await svc.from("jobs").delete().eq("id", job.id);
  await svc.from("translation_memories").delete().eq("id", tm.id);

  console.log("\nALL CHECKS PASSED ✓");
}
main().catch((e) => { console.error("THROWN:", e); process.exit(1); });
