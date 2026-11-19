/**
 * Loads an image job and renders its certified translation page.
 * The layout itself lives in certified-docx.ts.
 */

import { getServiceClient } from "@/lib/supabase/server";
import type { ImageRegionLocation } from "@/lib/jobs/image-extraction";
import { buildCertifiedDocx, type CertifiedField } from "@/lib/jobs/certified-docx";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export async function exportCertifiedTranslation(jobId: string): Promise<{ buffer: Buffer; filename: string } | { error: string }> {
  const supabase = await getServiceClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, reference, external_ref, source_lang, target_lang, source_filename, source_format, assigned_to, reviewer_id, meta")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { error: "Job not found" };
  if (job.source_format !== "image") return { error: "The certified translation page is only available for image jobs." };

  const { data: segs } = await supabase
    .from("segments")
    .select("seq, target_text, status, meta")
    .eq("job_id", jobId)
    .order("seq", { ascending: true });

  const fields: CertifiedField[] = [];
  for (const s of (segs ?? []) as Array<{ seq: number; target_text: string | null; status: string; meta: { location?: ImageRegionLocation } | null }>) {
    const loc = s.meta?.location;
    if (!loc || loc.kind !== "image_region") continue;
    fields.push({
      seq: s.seq,
      target: s.target_text ?? "",
      confirmed: s.status === "translated" || s.status === "reviewed" || s.status === "locked",
      page: loc.page,
      box: loc.box,
      pageWidth: loc.page_width,
      pageHeight: loc.page_height,
    });
  }
  if (fields.length === 0) return { error: "This job has no fields read from an image." };

  const { data: langs } = await supabase.from("languages").select("code, name").in("code", [job.source_lang, job.target_lang]);
  const langName = (code: string) => (langs ?? []).find((l) => l.code === code)?.name ?? code;

  const personIds = [job.assigned_to, job.reviewer_id].filter(Boolean) as string[];
  const { data: people } = personIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", personIds)
    : { data: [] as Array<{ id: string; full_name: string | null }> };
  const personName = (id: string | null) => (id ? (people ?? []).find((p) => p.id === id)?.full_name ?? null : null);

  const now = new Date();
  const meta = (job.meta ?? {}) as { document_type?: string; order_number?: string };
  const buffer = await buildCertifiedDocx({
    reference: job.reference,
    orderNumber: meta.order_number ?? job.external_ref ?? null,
    documentName: job.source_filename ?? "document",
    documentType: meta.document_type ?? null,
    sourceLanguage: langName(job.source_lang),
    targetLanguage: langName(job.target_lang),
    translator: personName(job.assigned_to),
    reviser: personName(job.reviewer_id),
    dateLabel: `${now.getUTCDate()} ${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`,
    fields,
  });
  const safeRef = String(job.reference).replace(/[^A-Za-z0-9._-]+/g, "_");
  return { buffer, filename: `${safeRef}_certified_translation.docx` };
}
