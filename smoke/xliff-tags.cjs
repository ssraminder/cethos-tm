// XLIFF inline-tag round-trip smoke. Mirrors src/lib/xliff/tags.ts logic.

const TAG_RE = /<\/?\w+(?:\s+[^>]*?)?\/?>/g;

function decodeEntities(s) { return s.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&"); }
function escapeXml(s) { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;"); }

function extract(inner) {
  const tags = [];
  let id = 0;
  const plain = inner.replace(TAG_RE, (m) => {
    id++;
    const kind = m.endsWith("/>") ? "empty" : m.startsWith("</") ? "close" : "open";
    tags.push({ id, original_xml: m, kind });
    return `{${id}}`;
  });
  return { plain_text: decodeEntities(plain), tags };
}

function reinsert(targetText, tags) {
  const byId = new Map(tags.map((t) => [t.id, t.original_xml]));
  const placeholderRe = /\{(\d+)\}/g;
  const parts = [];
  let i = 0, m;
  while ((m = placeholderRe.exec(targetText)) !== null) {
    if (m.index > i) parts.push(escapeXml(targetText.slice(i, m.index)));
    const id = Number(m[1]);
    parts.push(byId.get(id) ?? escapeXml(`{${id}}`));
    i = m.index + m[0].length;
  }
  if (i < targetText.length) parts.push(escapeXml(targetText.slice(i)));
  return parts.join("");
}

function compareTags(src, tgt) {
  const ids = (s) => {
    const set = new Set();
    const re = /\{(\d+)\}/g;
    let m;
    while ((m = re.exec(s)) !== null) set.add(Number(m[1]));
    return set;
  };
  const a = ids(src), b = ids(tgt);
  return {
    missing: [...a].filter((x) => !b.has(x)),
    extra: [...b].filter((x) => !a.has(x)),
  };
}

const cases = [
  {
    name: "g pair",
    inner: `Hello <g id="1">world</g>!`,
    expectPlain: "Hello {1}world{2}!",
    expectKinds: ["open", "close"],
  },
  {
    name: "x self-closing",
    inner: `Save <x id="1"/> file`,
    expectPlain: "Save {1} file",
    expectKinds: ["empty"],
  },
  {
    name: "ph wrapper",
    inner: `Click <ph id="1">{0}</ph> to continue`,
    expectPlain: "Click {1}{0}{2} to continue",
    expectKinds: ["open", "close"],
  },
  {
    name: "no tags",
    inner: `Plain text only.`,
    expectPlain: "Plain text only.",
    expectKinds: [],
  },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const e = extract(c.inner);
  const ok = e.plain_text === c.expectPlain && JSON.stringify(e.tags.map((t) => t.kind)) === JSON.stringify(c.expectKinds);
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name.padEnd(18)}  plain="${e.plain_text}"  kinds=${JSON.stringify(e.tags.map((t)=>t.kind))}`);
  if (!ok) fail++; else pass++;
}

// Round-trip: extract → translator preserves placeholders → reinsert
console.log("\nRound-trip:");
const rt1 = extract(`Save the <g id="1">file</g> to disk.`);
const tgtCorrect = "Enregistrez le {1}fichier{2} sur le disque.";
const rebuilt = reinsert(tgtCorrect, rt1.tags);
console.log("  rebuilt:", rebuilt);
const expected = `Enregistrez le <g id="1">fichier</g> sur le disque.`;
if (rebuilt !== expected) { console.error("  FAIL — expected:", expected); fail++; }
else { pass++; console.log("  PASS"); }

// QA tag mismatch
console.log("\nQA tag mismatch:");
const cmp1 = compareTags("Save the {1}file{2} now.", "Enregistrez le fichier maintenant.");
console.log("  missing:", cmp1.missing, "extra:", cmp1.extra);
if (cmp1.missing.length === 2 && cmp1.extra.length === 0) pass++; else fail++;

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
console.log("ALL CHECKS PASSED ✓");
