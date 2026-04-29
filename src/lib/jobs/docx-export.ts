/**
 * DOCX export — re-inject translated text into the original .docx shell.
 *
 * V2 (current): true OOXML run-level round-trip.
 *   - Segments carry an OOXML tag inventory in segments.meta.tags (open/close
 *     pairs for each <w:r> with rPr, hyperlink wrappers, br/tab markers).
 *   - At export, we walk word/document.xml paragraph-by-paragraph and
 *     replace each paragraph's body using rebuildParagraphBody from
 *     ooxml-tags.ts. The translator's {N} placeholders expand back to the
 *     matching <w:r>/<w:hyperlink>/<w:br>/<w:tab>.
 *
 * Fallback (V1): if a segment doesn't carry OOXML tags (e.g. ingested
 * before V2 shipped), we fall back to a single-run replacement that keeps
 * the paragraph's pPr but flattens inline formatting.
 */

import JSZip from "jszip";
import { getServiceClient } from "@/lib/supabase/server";
import { rebuildParagraphBody, type OoxmlTag } from "./ooxml-tags";

const STORAGE_BUCKET = "cat-source-files";

interface SegmentRow {
  seq: number;
  source_text: string;
  target_text: string;
  meta: { tags?: unknown } | null;
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
    .select("seq, source_text, target_text, meta")
    .eq("job_id", jobId)
    .order("seq", { ascending: true });
  if (!segs) return { error: "No segments found" };

  const translatedBuffer = await injectTranslatedParagraphs(sourceBuffer, segs as SegmentRow[]);

  const baseName = job.source_filename.replace(/\.docx$/i, "");
  return {
    buffer: translatedBuffer,
    filename: `${baseName}-${job.target_lang}.docx`,
  };
}

function isOoxmlTagArray(v: unknown): v is OoxmlTag[] {
  return (
    Array.isArray(v) &&
    v.every(
      (t) =>
        t &&
        typeof t === "object" &&
        typeof (t as Record<string, unknown>).id === "number" &&
        typeof (t as Record<string, unknown>).kind === "string" &&
        typeof (t as Record<string, unknown>).ooxml === "string",
    )
  );
}

async function injectTranslatedParagraphs(
  sourceBuffer: Buffer,
  segments: SegmentRow[],
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(sourceBuffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("document.xml not found in DOCX");
  const xml = await docFile.async("string");

  const segBySeq = new Map<number, SegmentRow>();
  for (const s of segments) segBySeq.set(s.seq, s);

  let seq = 0;
  const out: string[] = [];
  let cursor = 0;
  const PARA_RE = /<w:p\b[^>]*\/>|<w:p\b[^>]*>([\s\S]*?)<\/w:p\s*>/g;
  for (const m of xml.matchAll(PARA_RE)) {
    const matchStart = m.index ?? 0;
    out.push(xml.slice(cursor, matchStart));
    const fullPara = m[0];
    const innerBody = m[1];
    if (innerBody === undefined) {
      out.push(fullPara);
      cursor = matchStart + fullPara.length;
      continue;
    }
    if (!/<w:t\b/.test(innerBody)) {
      out.push(fullPara);
      cursor = matchStart + fullPara.length;
      continue;
    }
    seq += 1;
    const seg = segBySeq.get(seq);
    const translated = seg && seg.target_text.trim().length > 0 ? seg.target_text : seg?.source_text ?? "";
    const tags = (seg?.meta && typeof seg.meta === "object" && "tags" in seg.meta ? seg.meta.tags : null);

    if (isOoxmlTagArray(tags)) {
      // V2 path: rebuild with run-level fidelity.
      const pPrMatch = innerBody.match(/<w:pPr\b[\s\S]*?<\/w:pPr\s*>/);
      const pPr = pPrMatch?.[0];
      const open = (fullPara.match(/^<w:p\b[^>]*>/) || ["<w:p>"])[0];
      const newBody = rebuildParagraphBody(translated, tags, pPr);
      out.push(`${open}${newBody}</w:p>`);
    } else {
      // V1 fallback for legacy segments without OOXML tags.
      out.push(rewriteParagraphV1(fullPara, innerBody, stripPlaceholders(translated)));
    }
    cursor = matchStart + fullPara.length;
  }
  out.push(xml.slice(cursor));

  zip.file("word/document.xml", out.join(""));
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

function rewriteParagraphV1(fullPara: string, innerBody: string, translated: string): string {
  const open = (fullPara.match(/^<w:p\b[^>]*>/) || ["<w:p>"])[0];
  const pPr = (innerBody.match(/<w:pPr\b[\s\S]*?<\/w:pPr\s*>/) || [""])[0];
  const firstRPr = innerBody.match(/<w:r\b[^>]*>[\s\S]*?(<w:rPr\b[\s\S]*?<\/w:rPr\s*>)/);
  const rPr = firstRPr?.[1] ?? "";
  const safeText = translated.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const newRun = `<w:r>${rPr}<w:t xml:space="preserve">${safeText}</w:t></w:r>`;
  return `${open}${pPr}${newRun}</w:p>`;
}

function stripPlaceholders(s: string): string {
  return s.replace(/\{\d+\}/g, "").replace(/\s{2,}/g, " ").trim();
}
