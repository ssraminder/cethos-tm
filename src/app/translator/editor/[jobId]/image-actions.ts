"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { audit } from "@/lib/auth/audit";

/**
 * Actions that only apply to image jobs (segments read from a page image by
 * OCR). Correcting a source reading keeps the original OCR text in
 * meta.location.ocr_text, so every correction is a before/after pair that
 * can later be used to improve the OCR engine.
 */

export type ImageActionResult = { ok: true } | { ok: false; error: string };

const EDITABLE_JOB_STATUSES = ["assigned", "in_progress", "revision_requested"];
const ILLEGIBLE_TARGET = "[illegible]";

async function loadEditableSegment(segmentId: string, me: { id: string; role: string }) {
  const supabase = await getServiceClient();
  const { data: seg } = await supabase
    .from("segments")
    .select("id, job_id, seq, source_text, target_text, status, meta, jobs!inner(assigned_to, status)")
    .eq("id", segmentId)
    .maybeSingle();
  if (!seg) return { error: "Segment not found" as const };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = (seg as any).jobs as { assigned_to: string | null; status: string };
  if (job.assigned_to !== me.id && me.role !== "admin" && me.role !== "pm") return { error: "Not your job" as const };
  if (!EDITABLE_JOB_STATUSES.includes(job.status)) {
    return { error: `Cannot edit a job in '${job.status}' status` };
  }
  const meta = (seg.meta ?? {}) as Record<string, unknown>;
  const location = meta.location as { kind?: string } | undefined;
  if (location?.kind !== "image_region") return { error: "This segment was not read from an image" as const };
  return { supabase, seg, meta };
}

const CorrectSchema = z.object({
  segment_id: z.string().uuid(),
  source_text: z.string().trim().min(1).max(2000),
});

export async function correctSourceAction(input: { segment_id: string; source_text: string }): Promise<ImageActionResult> {
  const me = await getCurrentUser();
  const parsed = CorrectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter the text as it appears on the document." };

  const loaded = await loadEditableSegment(parsed.data.segment_id, me);
  if ("error" in loaded) return { ok: false, error: loaded.error ?? "Not allowed" };
  const { supabase, seg, meta } = loaded;

  const text = parsed.data.source_text;
  if (text === seg.source_text) return { ok: true };

  const norm = text.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
  const update: Record<string, unknown> = {
    source_text: text,
    source_hash: createHash("sha256").update(norm).digest("hex"),
    word_count: text.split(/\s+/).filter(Boolean).length,
    meta: { ...meta, source_corrected: { by: me.id, at: new Date().toISOString() } },
  };
  // A confirmed translation was confirmed against the old reading, so it
  // goes back to draft for the translator to look at again.
  if (seg.status === "translated" || seg.status === "reviewed") {
    update.status = "draft";
    update.confirmed_by = null;
    update.confirmed_at = null;
  }
  const { error } = await supabase.from("segments").update(update).eq("id", seg.id);
  if (error) return { ok: false, error: error.message };

  await audit({
    category: "job",
    action: "segment_source_corrected",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "job",
    targetId: seg.job_id,
    meta: { segment_id: seg.id, seq: seg.seq },
  });
  return { ok: true };
}

const IllegibleSchema = z.object({ segment_id: z.string().uuid() });

export async function markIllegibleAction(input: { segment_id: string }): Promise<ImageActionResult> {
  const me = await getCurrentUser();
  const parsed = IllegibleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const loaded = await loadEditableSegment(parsed.data.segment_id, me);
  if ("error" in loaded) return { ok: false, error: loaded.error ?? "Not allowed" };
  const { supabase, seg, meta } = loaded;

  // Left as a draft on purpose: a person still has to confirm it.
  const { error } = await supabase
    .from("segments")
    .update({
      target_text: ILLEGIBLE_TARGET,
      status: "draft",
      target_origin: "human",
      confirmed_by: null,
      confirmed_at: null,
      meta: { ...meta, illegible: { by: me.id, at: new Date().toISOString() } },
    })
    .eq("id", seg.id);
  if (error) return { ok: false, error: error.message };

  await audit({
    category: "job",
    action: "segment_marked_illegible",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "job",
    targetId: seg.job_id,
    meta: { segment_id: seg.id, seq: seg.seq },
  });
  return { ok: true };
}
