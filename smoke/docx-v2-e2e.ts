/**
 * End-to-end V2 smoke: read sample-import.docx, run the OOXML extractor,
 * fake-translate each paragraph (uppercase the text portion while keeping
 * placeholders intact), then rebuild and write the output. Validates the
 * round-trip preserves bold/italic spans + the hyperlink.
 *
 * Run with: npx tsx smoke/docx-v2-e2e.ts
 */

import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { extractOoxmlParagraphs, rebuildParagraphBody } from "../src/lib/jobs/ooxml-tags";

async function main() {
  const inPath = path.join(__dirname, "sample-import.docx");
  const outPath = path.join(__dirname, "sample-export-v2.docx");
  const buf = fs.readFileSync(inPath);

  const zip = await JSZip.loadAsync(buf);
  const docFile = zip.file("word/document.xml")!;
  const xml = await docFile.async("string");

  const paragraphs = extractOoxmlParagraphs(xml);
  console.log(`Extracted ${paragraphs.length} text-bearing paragraphs.`);

  // Show the first few segment texts so we can eyeball placeholder placement.
  for (const p of paragraphs.slice(0, 6)) {
    console.log(`#${p.para_index}: ${p.plain_text}`);
  }
  // Find the paragraph with the hyperlink.
  const linked = paragraphs.find((p) => p.tags.some((t) => t.ooxml === "hyperlink"));
  if (linked) {
    console.log(`Hyperlink paragraph #${linked.para_index}: ${linked.plain_text}`);
    console.log(`  tags: ${JSON.stringify(linked.tags)}`);
  }

  // Fake translation: uppercase letters between placeholders, preserve {N}.
  function fakeTranslate(text: string): string {
    return text.replace(/(\{\d+\}|[^{}]+)/g, (chunk) =>
      chunk.startsWith("{") ? chunk : `[FR] ${chunk.toUpperCase()}`,
    );
  }

  // Rebuild paragraphs into the document.
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
