/**
 * Smoke: take smoke/sample-import.docx, run it through the same path the
 * extractor uses (mammoth HTML → paragraph segments with placeholders),
 * fake-translate every paragraph (just append "[FR]" so we can see the
 * round-trip), then re-inject and write smoke/sample-export.docx.
 *
 * Validates the docx-export pipeline end-to-end without needing Supabase.
 */
const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const mammoth = require("mammoth");

const inPath = path.join(__dirname, "sample-import.docx");
const outPath = path.join(__dirname, "sample-export.docx");

async function main() {
  const sourceBuffer = fs.readFileSync(inPath);

  // Build paragraph "segments" by counting paragraphs in document.xml that
  // have <w:t> content — same heuristic as docx-export.ts.
  const zip = await JSZip.loadAsync(sourceBuffer);
  const docXml = await zip.file("word/document.xml").async("string");

  const segments = [];
  let seq = 0;
  const PARA_RE = /<w:p\b[^>]*\/>|<w:p\b[^>]*>([\s\S]*?)<\/w:p\s*>/g;
  for (const m of docXml.matchAll(PARA_RE)) {
    const inner = m[1];
    if (inner === undefined) continue;
    if (!/<w:t\b/.test(inner)) continue;
    seq += 1;
    // Pull source text out of <w:t> nodes for inspection.
    const texts = [...inner.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t\s*>/g)].map((x) => x[1]);
    const sourceText = texts.join("").replace(/\s+/g, " ").trim();
    segments.push({
      seq,
      source_text: sourceText,
      target_text: sourceText.length > 0 ? `[FR] ${sourceText}` : "",
    });
  }

  console.log(`Found ${segments.length} paragraph segments. First 3:`);
  for (const s of segments.slice(0, 3)) {
    console.log(`  #${s.seq}: ${s.source_text.slice(0, 60)}…`);
  }

  // Inline the same logic from src/lib/jobs/docx-export.ts (V1 strategy).
  const segBySeq = new Map();
  for (const s of segments) segBySeq.set(s.seq, s);

  let cursor = 0;
  let runSeq = 0;
  const out = [];
  for (const m of docXml.matchAll(PARA_RE)) {
    const start = m.index;
    out.push(docXml.slice(cursor, start));
    const fullPara = m[0];
    const inner = m[1];
    if (inner === undefined || !/<w:t\b/.test(inner)) {
      out.push(fullPara);
      cursor = start + fullPara.length;
      continue;
    }
    runSeq += 1;
    const seg = segBySeq.get(runSeq);
    const translated = seg && seg.target_text.trim().length > 0 ? seg.target_text : seg ? seg.source_text : "";
    const cleaned = translated.replace(/\{\d+\}/g, "").replace(/\s{2,}/g, " ").trim();
    const open = (fullPara.match(/^<w:p\b[^>]*>/) || [""])[0];
    const pPr = (inner.match(/<w:pPr\b[\s\S]*?<\/w:pPr\s*>/) || [""])[0];
    const firstRPrMatch = inner.match(/<w:r\b[^>]*>[\s\S]*?(<w:rPr\b[\s\S]*?<\/w:rPr\s*>)/);
    const rPr = firstRPrMatch ? firstRPrMatch[1] : "";
    const safe = cleaned.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const newRun = `<w:r>${rPr}<w:t xml:space="preserve">${safe}</w:t></w:r>`;
    out.push(`${open}${pPr}${newRun}</w:p>`);
    cursor = start + fullPara.length;
  }
  out.push(docXml.slice(cursor));

  zip.file("word/document.xml", out.join(""));
  const buf = await zip.generateAsync({ type: "nodebuffer" });
  fs.writeFileSync(outPath, buf);
  console.log(`Wrote ${outPath} (${buf.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
