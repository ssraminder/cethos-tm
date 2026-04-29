/**
 * V3 e2e: extract sample-v3-import.docx, dump the tags, fake-translate,
 * rebuild, write sample-v3-export.docx. Verifies footnote refs / bookmarks
 * / fields survive the round-trip as verbatim placeholders.
 *
 * Run: npx tsx smoke/docx-v3-e2e.ts
 */
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { extractOoxmlParagraphs, rebuildParagraphBody } from "../src/lib/jobs/ooxml-tags";

async function main() {
  const inPath = path.join(__dirname, "sample-v3-import.docx");
  const outPath = path.join(__dirname, "sample-v3-export.docx");
  const buf = fs.readFileSync(inPath);

  const zip = await JSZip.loadAsync(buf);
  const docFile = zip.file("word/document.xml")!;
  const xml = await docFile.async("string");

  const paragraphs = extractOoxmlParagraphs(xml);
  console.log(`Extracted ${paragraphs.length} paragraphs.\n`);

  for (const p of paragraphs) {
    console.log(`#${p.para_index}: ${p.plain_text}`);
    const verbatimTags = p.tags.filter((t) => t.ooxml === "verbatim");
    if (verbatimTags.length > 0) {
      for (const t of verbatimTags) {
        const preview = t.verbatim_xml ? t.verbatim_xml.slice(0, 80).replace(/\n/g, " ") : "";
        console.log(`   {${t.id}} verbatim: ${preview}…`);
      }
    }
  }
  console.log("");

  // Fake-translate by uppercasing visible text only.
  function fakeTranslate(text: string): string {
    return text.replace(/(\{\d+\}|[^{}]+)/g, (chunk) =>
      chunk.startsWith("{") ? chunk : `[FR] ${chunk.toUpperCase()}`,
    );
  }

  // Rebuild
  const PARA_RE = /<w:p\b[^>]*\/>|<w:p\b[^>]*>([\s\S]*?)<\/w:p\s*>/g;
  const segByIndex = new Map(paragraphs.map((p) => [p.para_index, p]));
  let paraIndex = -1;
  let cursor = 0;
  const out: string[] = [];
  for (const m of xml.matchAll(PARA_RE)) {
    paraIndex += 1;
    const start = m.index ?? 0;
    out.push(xml.slice(cursor, start));
    const fullPara = m[0];
    const inner = m[1];
    const seg = segByIndex.get(paraIndex);
    if (!seg || inner === undefined) {
      out.push(fullPara);
      cursor = start + fullPara.length;
      continue;
    }
    const open = fullPara.match(/^<w:p\b[^>]*>/)![0];
    const newBody = rebuildParagraphBody(fakeTranslate(seg.plain_text), seg.tags, seg.p_pr);
    out.push(`${open}${newBody}</w:p>`);
    cursor = start + fullPara.length;
  }
  out.push(xml.slice(cursor));

  zip.file("word/document.xml", out.join(""));
  const buf2 = await zip.generateAsync({ type: "nodebuffer" });
  fs.writeFileSync(outPath, buf2);
  console.log(`Wrote ${outPath} (${buf2.length} bytes)`);

  // Sanity: verify the verbatim XML survived.
  const zip2 = await JSZip.loadAsync(buf2);
  const xml2 = await zip2.file("word/document.xml")!.async("string");
  const checks = [
    { name: "footnoteReference", re: /<w:footnoteReference\b/ },
    { name: "bookmarkStart", re: /<w:bookmarkStart\b/ },
    { name: "bookmarkEnd", re: /<w:bookmarkEnd\b/ },
    { name: "fldChar / instrText (page number)", re: /<w:instrText\b|<w:fldChar\b/ },
    { name: "tab character", re: /<w:tab\b/ },
  ];
  console.log("\nRound-trip integrity:");
  for (const c of checks) {
    console.log(`  ${c.re.test(xml2) ? "✓" : "✗"} ${c.name}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
