import { createHash } from "node:crypto";
import { getServiceClient } from "@/lib/supabase/server";
import {
  detectFormat,
  extractText,
  extractParagraphsWithTags,
  type SupportedFormat,
} from "@/lib/jobs/extraction";
import { segmentText, totalWords, type Segment } from "@/lib/jobs/segmentation";
import { parseXliff } from "@/lib/xliff/parse";
import { generateJobReference } from "@/lib/jobs/reference";
import { getOrCreateDefaultTm } from "@/lib/tm/default-tm";

const STORAGE_BUCKET = "cat-source-files";

export interface CreateJobInput {
  source_buffer: Buffer;
  source_filename: string;
  source_mime_type?: string;
  source_lang: string;
  target_lang: string;
  reference?: string;
  external_ref?: string;
  source: "manual" | "tms_push";
  created_by: string;             // profile id
  assigned_to?: string | null;
  reviewer_id?: string | null;
  client_id?: string | null;
  deadline?: string | null;
  qa_profile_id?: string | null;
  tm_ids?: string[];
  termbase_ids?: string[];
}

export interface CreateJobResult {
  job_id: string;
  reference: string;
  segments: number;
  words: number;
  source_format: SupportedFormat;
}

/**
 * Shared job creation pipeline used by both the manual upload UI and the
 * external TMS ingest API. Extracts text, segments, uploads source file,
 * inserts job + segments + resource attachments.
 */
export async function createJobFromBuffer(input: CreateJobInput): Promise<CreateJobResult> {
  if (input.source_lang === input.target_lang) {
    throw new Error("Source and target languages must differ.");
  }
  if (!input.source_buffer || input.source_buffer.length === 0) {
    throw new Error("Empty source file.");
  }
  if (input.source_buffer.length > 50 * 1024 * 1024) {
    throw new Error("Source file too large (max 50 MB).");
  }

  const format = detectFormat(input.source_filename, input.source_mime_type) as SupportedFormat;
  if (format === "unknown") throw new Error(`Unsupported file format: ${input.source_filename}`);

  // Extract / segment.
  let segments: Segment[];
  let preTargets: Map<number, { text: string; status: "draft" | "translated" }> | null = null;
  let segmentTags: Map<number, unknown[]> | null = null;
  let actualSource = input.source_lang;
  let actualTarget = input.target_lang;

  if (format === "xliff") {
    const parsed = parseXliff(input.source_buffer);
    if (parsed.source_lang) actualSource = parsed.source_lang;
    if (parsed.target_lang) actualTarget = parsed.target_lang;
    if (actualSource === actualTarget) throw new Error("XLIFF source and target languages identical.");
    if (parsed.units.length === 0) throw new Error("XLIFF contained no translatable units.");
    segments = [];
    preTargets = new Map();
    segmentTags = new Map();
    parsed.units.forEach((u, i) => {
      const seq = i + 1;
      const norm = u.source_text.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
      segments.push({
        seq,
        source_text: u.source_text.trim(),
        source_hash: createHash("sha256").update(norm).digest("hex"),
        word_count: u.source_text.trim().split(/\s+/).filter(Boolean).length,
      });
      if (u.target_text && u.target_text.trim()) {
        const isFinal = u.approved === true || u.state === "translated" || u.state === "final";
        preTargets!.set(seq, { text: u.target_text.trim(), status: isFinal ? "translated" : "draft" });
      }
      if (u.source_tags && u.source_tags.length > 0) segmentTags!.set(seq, u.source_tags);
    });
  } else if (format === "docx" || format === "html") {
    // Tag-preserving path: each paragraph becomes one segment carrying its
    // own inline-tag inventory in segments.meta.tags.
    const paragraphs = await extractParagraphsWithTags(input.source_buffer, format);
    if (paragraphs.length === 0) throw new Error("No translatable text found in the source.");
    segments = [];
    segmentTags = new Map();
    paragraphs.forEach((p, i) => {
      const seq = i + 1;
      const text = p.plain_text;
      const norm = text.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
      segments.push({
        seq,
        source_text: text,
        source_hash: createHash("sha256").update(norm).digest("hex"),
        word_count: text.split(/\s+/).filter(Boolean).length,
      });
      if (p.tags.length > 0) segmentTags!.set(seq, p.tags);
    });
  } else {
    const plain = await extractText(input.source_buffer, format);
    segments = segmentText(plain);
    if (segments.length === 0) throw new Error("No translatable text found in the source.");
  }

  const wordTotal = totalWords(segments);
  const reference = (input.reference && input.reference.trim()) || generateJobReference();

  const supabase = await getServiceClient();
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .insert({
      reference,
      source: input.source,
      external_ref: input.external_ref ?? null,
      client_id: input.client_id ?? null,
      source_lang: actualSource,
      target_lang: actualTarget,
      status: input.assigned_to ? "assigned" : "draft",
      source_filename: input.source_filename,
      source_format: format,
      word_count: wordTotal,
      segment_count: segments.length,
      created_by: input.created_by,
      assigned_to: input.assigned_to ?? null,
      reviewer_id: input.reviewer_id ?? null,
      qa_profile_id: input.qa_profile_id ?? null,
      deadline: input.deadline ?? null,
    })
    .select("id, reference")
    .single();
  if (jobErr || !job) throw new Error(`Job insert failed: ${jobErr?.message ?? "unknown"}`);

  const jobId = job.id;
  const storagePath = `jobs/${jobId}/source/${input.source_filename}`;

  const { error: uploadErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, input.source_buffer, {
      contentType: input.source_mime_type || "application/octet-stream",
      upsert: false,
    });
  if (uploadErr) {
    await supabase.from("jobs").delete().eq("id", jobId);
    throw new Error(`Source upload failed: ${uploadErr.message}`);
  }
  await supabase.from("jobs").update({ source_storage_path: storagePath }).eq("id", jobId);

  const rows = segments.map((s) => {
    const pre = preTargets?.get(s.seq);
    const tags = segmentTags?.get(s.seq);
    return {
      job_id: jobId,
      seq: s.seq,
      source_text: s.source_text,
      source_hash: s.source_hash,
      word_count: s.word_count,
      target_text: pre?.text ?? "",
      status: pre?.status ?? "untranslated",
      meta: tags ? { tags } : {},
    };
  });
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error: segErr } = await supabase.from("segments").insert(slice);
    if (segErr) {
      await supabase.from("segments").delete().eq("job_id", jobId);
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      await supabase.from("jobs").delete().eq("id", jobId);
      throw new Error(`Segment insert failed: ${segErr.message}`);
    }
  }

  // Attach TMs / termbases. Always include the default TM for this language
  // pair (auto-created on first use) so confirmed segments accumulate into a
  // leverageable corpus across jobs. Explicit `tm_ids` from input are added
  // alongside it at higher priority (lower number = higher priority); the
  // default TM gets priority 1000 so it's the catch-all fallback.
  const resourceRows: Array<{ job_id: string; resource_type: string; resource_id: string; priority: number }> = [];

  let defaultTmId: string | null = null;
  try {
    defaultTmId = await getOrCreateDefaultTm({
      source_lang: actualSource,
      target_lang: actualTarget,
      created_by: input.created_by,
    });
  } catch (e) {
    // Non-fatal: log + continue without a default TM. Job still works, just
    // without auto-leverage. Caller can attach a TM manually later.
    console.error(
      `[createJobFromBuffer] default TM lookup/create failed (${actualSource}->${actualTarget}):`,
      e instanceof Error ? e.message : String(e),
    );
  }
  if (defaultTmId) {
    resourceRows.push({ job_id: jobId, resource_type: "tm", resource_id: defaultTmId, priority: 1000 });
  }
  for (const tm_id of input.tm_ids ?? []) {
    if (tm_id === defaultTmId) continue; // don't double-attach
    resourceRows.push({ job_id: jobId, resource_type: "tm", resource_id: tm_id, priority: 100 });
  }
  for (const tb_id of input.termbase_ids ?? []) resourceRows.push({ job_id: jobId, resource_type: "termbase", resource_id: tb_id, priority: 100 });
  if (resourceRows.length > 0) {
    await supabase.from("job_resources").insert(resourceRows);
  }

  return {
    job_id: jobId,
    reference: job.reference,
    segments: segments.length,
    words: wordTotal,
    source_format: format,
  };
}
