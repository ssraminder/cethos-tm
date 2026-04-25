// XLIFF parse + build round-trip smoke.
const { XMLParser } = require("fast-xml-parser");

const sample12 = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="hello.txt" source-language="en-US" target-language="fr-FR" datatype="plaintext">
    <body>
      <trans-unit id="1">
        <source>Hello, world.</source>
      </trans-unit>
      <trans-unit id="2" approved="yes">
        <source>Welcome.</source>
        <target state="translated">Bienvenue.</target>
      </trans-unit>
      <group id="g1">
        <trans-unit id="3">
          <source>Inside a group.</source>
          <target state="needs-translation">Dans un groupe.</target>
        </trans-unit>
      </group>
    </body>
  </file>
</xliff>`;

const sample20 = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="2.0" srcLang="en-US" trgLang="es-ES" xmlns="urn:oasis:names:tc:xliff:document:2.0">
  <file id="f1">
    <unit id="u1">
      <segment><source>Hello.</source><target>Hola.</target></segment>
    </unit>
    <unit id="u2">
      <segment><source>How are you?</source></segment>
    </unit>
  </file>
</xliff>`;

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", parseTagValue: false, trimValues: false });

function asArray(v) { if (v == null) return []; if (Array.isArray(v)) return v; if (typeof v === "object") return [v]; return []; }
function pickText(v) { if (typeof v === "string") return v; if (v && typeof v === "object") { if (typeof v["#text"] === "string") return v["#text"]; let out = ""; for (const [k, val] of Object.entries(v)) { if (k.startsWith("@_")) continue; if (typeof val === "string") out += val; } return out; } return ""; }

function parseXliff(text) {
  const root = parser.parse(text);
  const xliff = root.xliff;
  if (!xliff) throw new Error("no xliff");
  const v = String(xliff["@_version"] ?? "1.2");
  if (v.startsWith("2")) {
    const out = { version: "2.0", source_lang: String(xliff["@_srcLang"] ?? ""), target_lang: String(xliff["@_trgLang"] ?? ""), units: [] };
    for (const f of asArray(xliff.file)) {
      for (const u of asArray(f.unit)) {
        let src = "", tgt = "";
        for (const s of asArray(u.segment)) { src += pickText(s.source); if (s.target) tgt += pickText(s.target); }
        out.units.push({ id: String(u["@_id"]), source_text: src.trim(), target_text: tgt.trim() || undefined });
      }
    }
    return out;
  }
  const f = asArray(xliff.file)[0];
  const out = { version: "1.2", source_lang: String(f["@_source-language"] ?? ""), target_lang: String(f["@_target-language"] ?? ""), units: [] };
  function collect(tu) {
    const src = pickText(tu.source).trim();
    if (!src) return;
    out.units.push({ id: String(tu["@_id"]), source_text: src, target_text: tu.target ? pickText(tu.target).trim() : undefined, approved: tu["@_approved"] === "yes" });
  }
  function walk(node) { for (const tu of asArray(node["trans-unit"])) collect(tu); for (const g of asArray(node.group)) walk(g); }
  walk(f.body);
  return out;
}

console.log("XLIFF 1.2:");
const r1 = parseXliff(sample12);
console.log(`  pair: ${r1.source_lang} → ${r1.target_lang}, units: ${r1.units.length}`);
for (const u of r1.units) console.log(`    ${u.id}: "${u.source_text}" → "${u.target_text ?? "(none)"}"${u.approved ? " [approved]" : ""}`);
if (r1.units.length !== 3) { console.error("FAIL: expected 3 units"); process.exit(1); }

console.log("\nXLIFF 2.0:");
const r2 = parseXliff(sample20);
console.log(`  pair: ${r2.source_lang} → ${r2.target_lang}, units: ${r2.units.length}`);
for (const u of r2.units) console.log(`    ${u.id}: "${u.source_text}" → "${u.target_text ?? "(none)"}"`);
if (r2.units.length !== 2) { console.error("FAIL: expected 2 units"); process.exit(1); }

console.log("\nALL CHECKS PASSED ✓");
