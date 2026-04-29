/**
 * PPTX e2e smoke: extract sample-import.pptx, fake-translate, rebuild,
 * write sample-export.pptx. Verify round-trip re-extraction returns the
 * translated text and the structure is intact.
 *
 * Run: npx tsx smoke/pptx-roundtrip-e2e.ts
 */
import fs from "node:fs";
import path from "node:path";
import { extractPptxBuffer, exportPptxBuffer } from "../src/lib/jobs/pptx-extraction";

async function main() {
  const inPath = path.join(__dirname, "sample-import.pptx");
  const outPath = path.join(__dirname, "sample-export.pptx");
  const buf = fs.readFileSync(inPath);

  const paragraphs = await extractPptxBuffer(buf);
  console.log(`Extracted ${paragraphs.length} translatable paragraphs.\n`);
  for (const p of paragraphs) {
    console.log(`  [${p.location.file}#${p.location.para}] ${p.plain_text}`);
  }
  console.log("");

  function fakeTranslate(text: string): string {
    return text.replace(/(\{\d+\}|[^{}]+)/g, (chunk) =>
      chunk.startsWith("{") ? chunk : `[FR] ${chunk.toUpperCase()}`,
    );
  }

  const translated = paragraphs.map((p) => ({
    source_text: p.plain_text,
    target_text: fakeTranslate(p.plain_text),
    tags: p.tags,
    location: p.location,
  }));

  const outBuf = await exportPptxBuffer(buf, translated);
  fs.writeFileSync(outPath, outBuf);
  console.log(`Wrote ${outPath} (${outBuf.length} bytes)`);

  const re = await extractPptxBuffer(outBuf);
  console.log(`\nRe-extraction yields ${re.length} paragraphs.`);
  console.log("First 5 (should be uppercase + [FR] prefix):");
  for (const p of re.slice(0, 5)) {
    console.log(`  ${p.plain_text}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
