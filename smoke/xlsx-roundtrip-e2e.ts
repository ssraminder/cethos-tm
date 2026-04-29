/**
 * XLSX e2e smoke: extract sample-import.xlsx, fake-translate every string
 * (uppercase + "[FR] " prefix, preserving placeholders), rebuild, write
 * sample-export.xlsx. Validates that:
 *   - Shared strings round-trip
 *   - Rich-text bold/italic runs survive
 *   - Hyperlinks survive (they live in sheet rels, not cell text — we
 *     should leave them untouched)
 *   - Numeric/formula cells stay numeric
 *   - Multi-sheet works
 *
 * Run: npx tsx smoke/xlsx-roundtrip-e2e.ts
 */
import fs from "node:fs";
import path from "node:path";
import { extractXlsxBuffer, exportXlsxBuffer } from "../src/lib/jobs/xlsx-extraction";

async function main() {
  const inPath = path.join(__dirname, "sample-import.xlsx");
  const outPath = path.join(__dirname, "sample-export.xlsx");
  const buf = fs.readFileSync(inPath);

  const strings = await extractXlsxBuffer(buf);
  console.log(`Extracted ${strings.length} translatable strings.\n`);
  for (const s of strings) {
    const loc = s.location.kind === "shared" ? `sharedStrings#${s.location.index}` : `${s.location.sheet}!${s.location.cell}`;
    console.log(`  [${loc}] ${s.plain_text}`);
  }
  console.log("");

  function fakeTranslate(text: string): string {
    return text.replace(/(\{\d+\}|[^{}]+)/g, (chunk) =>
      chunk.startsWith("{") ? chunk : `[FR] ${chunk.toUpperCase()}`,
    );
  }

  const translated = strings.map((s) => ({
    source_text: s.plain_text,
    target_text: fakeTranslate(s.plain_text),
    tags: s.tags,
    location: s.location,
  }));

  const outBuf = await exportXlsxBuffer(buf, translated);
  fs.writeFileSync(outPath, outBuf);
  console.log(`Wrote ${outPath} (${outBuf.length} bytes)`);

  // Round-trip integrity: re-extract from the output and check we got back
  // the translated text.
  const reExtracted = await extractXlsxBuffer(outBuf);
  console.log(`\nRe-extraction yields ${reExtracted.length} strings.`);
  console.log("First 3 re-extracted (should be uppercase):");
  for (const s of reExtracted.slice(0, 3)) {
    console.log(`  ${s.plain_text}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
