// CommonJS smoke for segmentation only (no .ts imports)
const sbd = require("sbd");
const { createHash } = require("node:crypto");

function normalize(s) { return s.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase(); }
function hash(s) { return createHash("sha256").update(normalize(s)).digest("hex"); }
function wordCount(s) { return s.trim() ? s.trim().split(/\s+/).length : 0; }

function segmentText(text) {
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const out = [];
  let seq = 0;
  for (const para of paragraphs) {
    const sentences = sbd.sentences(para, { newline_boundaries: false, sanitize: false });
    for (const raw of sentences) {
      const t = raw.trim();
      if (!t) continue;
      seq++;
      out.push({ seq, source_text: t, source_hash: hash(t), word_count: wordCount(t) });
    }
  }
  return out;
}

const samples = {
  "english multi-paragraph": `Hello, world. This is the first paragraph with two sentences.

Second paragraph! It has questions? And exclamations.

And finally, a third short one.`,

  "abbreviations": `Dr. Smith met Mr. Lee at 3 p.m. They discussed the report. The U.S. economy is recovering.`,

  "single line": `One sentence only`,

  "empty": ``,

  "only whitespace": `   \n\n   `,
};

for (const [name, text] of Object.entries(samples)) {
  const segs = segmentText(text);
  console.log(`\n[${name}] -> ${segs.length} segments, ${segs.reduce((s,x)=>s+x.word_count,0)} words`);
  for (const s of segs) console.log(`  ${s.seq}. [${s.word_count}w] ${s.source_text}`);
}
