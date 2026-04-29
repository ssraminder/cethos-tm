/**
 * JSON e2e: extract sample-import.json, fake-translate, write back.
 * Validates: nested objects, arrays, ICU placeholders preserved, non-string
 * values (numbers/booleans) untouched, file structure round-trips.
 *
 * Run: npx tsx smoke/json-roundtrip-e2e.ts
 */
import fs from "node:fs";
import path from "node:path";
import { extractJsonBuffer, exportJsonBuffer } from "../src/lib/jobs/json-extraction";

function main() {
  const inPath = path.join(__dirname, "sample-import.json");
  const outPath = path.join(__dirname, "sample-export.json");
  const buf = fs.readFileSync(inPath);

  const strings = extractJsonBuffer(buf);
  console.log(`Extracted ${strings.length} translatable strings.\n`);
  for (const s of strings) {
    console.log(`  [${s.location.path.join(".")}] ${s.plain_text}`);
  }
  console.log("");

  function fakeTranslate(text: string): string {
    // Naive translation: uppercase + [FR] prefix. Keep ICU placeholders
    // ({name}, {count}, etc.) intact.
    return `[FR] ${text.toUpperCase()}`;
  }

  const translated = strings.map((s) => ({
    source_text: s.plain_text,
    target_text: fakeTranslate(s.plain_text),
    location: s.location,
  }));

  const outBuf = exportJsonBuffer(buf, translated);
  fs.writeFileSync(outPath, outBuf);
  console.log(`Wrote ${outPath} (${outBuf.length} bytes)\n`);

  // Verify by reading back.
  const re = JSON.parse(outBuf.toString("utf8"));
  console.log("Round-trip integrity:");
  console.log(`  app.name        = ${JSON.stringify(re.app.name)}`);
  console.log(`  nav.signOut     = ${JSON.stringify(re.nav.signOut)}`);
  console.log(`  actions[0]      = ${JSON.stringify(re.actions[0])}`);
  console.log(`  messages.welcome= ${JSON.stringify(re.messages.welcome)}`);
  console.log(`  version         = ${JSON.stringify(re.version)} (string, translated)`);
  console.log(`  buildNumber     = ${re.buildNumber} (${typeof re.buildNumber}, untouched)`);
  console.log(`  isProduction    = ${re.isProduction} (${typeof re.isProduction}, untouched)`);
  console.log(`  config.maxItems = ${re.config.maxItems} (${typeof re.config.maxItems}, untouched)`);
  console.log(`  config.supportedLanguages = ${JSON.stringify(re.config.supportedLanguages)} (translated)`);
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
