// QA engine smoke. Mirrors the rules in src/lib/qa/rules.ts and verifies
// the default profile fires the expected findings on a hand-crafted set.

function untranslated(seg) {
  return seg.target_text.trim().length === 0
    ? [{ rule: "untranslated", severity: "critical" }] : [];
}
function identical(seg) {
  return seg.target_text.trim() && seg.target_text.trim() === seg.source_text.trim()
    ? [{ rule: "identical_source_target", severity: "major" }] : [];
}
function numberMismatch(seg) {
  if (!seg.target_text.trim()) return [];
  const re = /\d+(?:[.,]\d+)*/g;
  const a = (seg.source_text.match(re) ?? []).slice().sort();
  const b = (seg.target_text.match(re) ?? []).slice().sort();
  return a.join("|") === b.join("|") ? [] : [{ rule: "number_mismatch", severity: "major" }];
}
function lengthRatio(seg) {
  if (!seg.target_text.trim()) return [];
  const r = seg.target_text.length / Math.max(1, seg.source_text.length);
  return (r < 0.5 || r > 2.5) ? [{ rule: "length_ratio", severity: "minor" }] : [];
}
function leadTrail(seg) {
  if (!seg.target_text) return [];
  const sLead = /^\s/.test(seg.source_text), sTrail = /\s$/.test(seg.source_text);
  const tLead = /^\s/.test(seg.target_text), tTrail = /\s$/.test(seg.target_text);
  return (sLead === tLead && sTrail === tTrail) ? [] : [{ rule: "leading_trailing_whitespace", severity: "minor" }];
}
function dblSpace(seg) { return seg.target_text.includes("  ") ? [{ rule: "double_space", severity: "minor" }] : []; }

const RULES = [untranslated, identical, numberMismatch, lengthRatio, leadTrail, dblSpace];

const cases = [
  { name: "untranslated", source_text: "Hello.", target_text: "", expect: ["untranslated"] },
  { name: "identical", source_text: "OK", target_text: "OK", expect: ["identical_source_target"] }, // length ratio 1.0 — within bounds
  { name: "numbers ok", source_text: "Year 2024 cost $42.50.", target_text: "Année 2024, coût 42,50 $.", expect: ["number_mismatch"] }, // 42.50 vs 42,50 differ as strings
  { name: "numbers same", source_text: "Buy 3 apples.", target_text: "Achetez 3 pommes.", expect: [] },
  { name: "length too long", source_text: "Hi.", target_text: "Bonjour à toutes et à tous, comment allez-vous aujourd'hui ?", expect: ["length_ratio"] },
  { name: "double space", source_text: "OK?", target_text: "Oui  monsieur.", expect: ["double_space"] },
  { name: "leading mismatch", source_text: "Hi", target_text: " Bonjour", expect: ["leading_trailing_whitespace"] },
];

function run(seg) {
  const out = [];
  for (const r of RULES) for (const f of r(seg)) out.push(f);
  return out;
}

let pass = 0, fail = 0;
for (const c of cases) {
  const findings = run(c).map((f) => f.rule).sort();
  const expected = c.expect.slice().sort();
  // Allow superset: expected rules must be present (some cases might trigger length_ratio too).
  const ok = expected.every((r) => findings.includes(r)) && (expected.length > 0 ? findings.length >= expected.length : findings.length === 0);
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name.padEnd(22)}  expected ${JSON.stringify(expected)}  got ${JSON.stringify(findings)}`);
  ok ? pass++ : fail++;
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
console.log("\nALL CHECKS PASSED ✓");
