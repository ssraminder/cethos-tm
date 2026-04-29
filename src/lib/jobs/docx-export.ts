/**
 * DOCX export — re-inject translated text into the original .docx shell.
 *
 * V1 strategy (current):
 *   - Pull the original .docx from Supabase storage
 *   - Walk word/document.xml in paragraph order
 *   - For each paragraph, find the segment with matching sequence and replace
 *     the paragraph's runs with a single new run carrying the translated
 *     text. Paragraph-level properties (heading style, list numbering,
 *     alignment) are preserved by leaving <w:pPr> untouched. The first
 *     existing run's <w:rPr> is reused so the new run inherits font/size.
 *   - Strip {N} placeholders from the translated text. (Full inline-tag
 *     round-trip is V2 — see notes at end of file.)
 *
 * Limitations:
 *   - Inline bold/italic/hyperlink BOUNDARIES are lost. The whole paragraph
 *     adopts the rPr of the first run.
 *   - Paragraph count between original and translated must match. If a
 *     translator splits or merges paragraphs we fall back to using the
 *     untranslated source for that paragraph.
 */

import JSZip from "jszip";
import { getServiceClient } from "@/lib/supabase/server";

const STORAGE_BUCKET = "cat-source-files";

interface Segment {
  seq: number;
  source_text: string;
  target_text: string;
}

export async function exportJobAsDocx(jobId: string): Promise<{
  buffer: Buffer;
  filename: string;
} | { error: string }> {
  const supabase = await getServiceClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, reference, source_filename, source_format, source_storage_path, target_lang")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { error: "Job not found" };
  if (job.source_format !== "docx") {
    return { error: `Cannot export DOCX from a ${job.source_format} source` };
  }
  if (!job.source_storage_path) {
    return { error: "Source file no longer in storage" };
  }

  const { data: file, error: dlErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(job.source_storage_path);
  if (dlErr || !file) return { error: `Could not download source: ${dlErr?.message ?? "unknown"}` };

  const sourceBuffer = Buffer.from(await file.arrayBuffer());

  const { data: segs } = await supabase
    .from("segments")
    .select("seq, source_text, target_text")
    .eq("job_id", jobId)
    .order("seq", { ascending: true });
  if (!segs) return { error: "No segments found" };

  const translatedBuffer = await injectTranslatedParagraphs(sourceBuffer, segs as Segment[]);

  const baseName = job.source_filename.replace(/\.docx$/i, "");
  return {
    buffer: translatedBuffer,
    filename: `${baseName}-${job.target_lang}.docx`,
  };
}

/**
 * Replace each <w:p>'s runs with a single run carrying the matching segment's
 * translated text. Preserves <w:pPr> so heading/list/alignment styling
 * survives.
 *
 * The mapping is positional: paragraph #1 in the document gets segment seq=1,
 * etc. Empty paragraphs (no <w:t> content) are skipped — they don't have a
 * corresponding segment.
 */
async function injectTranslatedParagraphs(
  sourceBuffer: Buffer,
  segments: Segment[],
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(sourceBuffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("document.xml not found in DOCX");
  const xml = await docFile.async("string");

  const segBySeq = new Map<number, Segment>();
  for (const s of segments) segBySeq.set(s.seq, s);

  // Walk <w:p> ... </w:p> blocks. Self-closing <w:p/> means an empty para
  // (no text), skip.
  let seq = 0;
  const out: string[] = [];
  let cursor = 0;
  const PARA_RE = /<w:p\b[^>]*\/>|<w:p\b[^>]*>([\s\S]*?)<\/w:p\s*>/g;
  for (const m of xml.matchAll(PARA_RE)) {
    const matchStart = m.index ?? 0;
    out.push(xml.slice(cursor, matchStart));
    const fullPara = m[0];
    const innerBody = m[1]; // undefined for self-closing
    if (innerBody === undefined) {
      out.push(fullPara);
      cursor = matchStart + fullPara.length;
      continue;
    }
    // Skip paragraphs with no text content (e.g. just a section break).
    if (!/<w:t\b/.test(innerBody)) {
      out.push(fullPara);
      cursor = matchStart + fullPara.length;
      continue;
    }
    seq += 1;
    const seg = segBySeq.get(seq);
    const translated = seg && seg.target_text.trim().length > 0 ? seg.target_text : seg?.source_text ?? "";
    const cleaned = stripPlaceholders(translated);
    out.push(rewriteParagraph(fullPara, innerBody, cleaned));
    cursor = matchStart + fullPara.length;
  }
  out.push(xml.slice(cursor));

  zip.file("word/document.xml", out.join(""));
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

/**
 * Build a replacement <w:p> that keeps the original <w:pPr> (and any
 * paragraph-level run properties stashed inside <w:pPr><w:rPr>) plus a single
 * new <w:r> carrying the translated text. Reuses the first <w:r>'s <w:rPr>
 * if present so font/size are preserved.
 */
function rewriteParagraph(fullPara: string, innerBody: string, translated: string): string {
  // Pull the opening <w:p ...> tag verbatim so we keep its attributes.
  const openMatch = fullPara.match(/^<w:p\b[^>]*>/);
  const open = openMatch?.[0] ?? "<w:p>";

  // Keep the existing <w:pPr> block if present (paragraph style, list, etc.).
  const pPrMatch = innerBody.match(/<w:pPr\b[\s\S]*?<\/w:pPr\s*>/);
  const pPr = pPrMatch?.[0] ?? "";

  // Inherit rPr from the first run that has one. If none, omit rPr.
  const firstRPr = innerBody.match(/<w:r\b[^>]*>[\s\S]*?(<w:rPr\b[\s\S]*?<\/w:rPr\s*>)/);
  const rPr = firstRPr?.[1] ?? "";

  const safeText = escapeXmlText(translated);
  const newRun = `<w:r>${rPr}<w:t xml:space="preserve">${safeText}</w:t></w:r>`;
  return `${open}${pPr}${newRun}</w:p>`;
}

function escapeXmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stripPlaceholders(s: string): string {
  return s.replace(/\{\d+\}/g, "").replace(/\s{2,}/g, " ").trim();
}

/*
 * V2 (future): true round-trip preserving inline run boundaries.
 *
 * Plan:
 *   1. At extraction (createJobFromBuffer / extractParagraphsWithTags),
 *      walk OOXML directly instead of mammoth-HTML. For each paragraph,
 *      iterate <w:r> runs, group consecutive runs with matching <w:rPr>
 *      into one text segment, and emit a {N} placeholder at every rPr
 *      boundary (or at hyperlink/<w:hyperlink> entry/exit).
 *   2. Store the original rPr blocks in segments.meta.tags keyed by id.
 *   3. At export, when walking the original paragraph, replace its run
 *      list with a sequence built from the translated text: each chunk
 *      between {N} placeholders becomes a <w:r> with the corresponding
 *      rPr from the inventory.
 *
 * This approach perfectly round-trips bold/italic/underline/hyperlinks.
 * Tables and lists are unchanged because they're paragraph-level (still
 * handled by V1).
 */
