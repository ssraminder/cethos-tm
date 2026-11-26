"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { audit } from "@/lib/auth/audit";
import { jobEditAccess, recordSegmentEdit, type SegmentEditAction } from "@/lib/jobs/edit-access";

/**
 * Actions that only apply to image jobs (segments read from a page image by
 * OCR). Correcting a source reading keeps the original OCR text in
 * meta.location.ocr_text, so every correction is a before/after pair that
 * can later be used to improve the OCR engine.
 */

export type ImageActionResult = { ok: true } | { ok: false; error: string };

const ILLEGIBLE_TARGET = "[illegible]";

async function loadEditableSegment(segmentId: string, me: { id: string; role: string; email?: string | null }) {
  const supabase = await getServiceClient();
  const { data: seg } = await supabase
    .from("segments")
    .select("id, job_id, seq, source_text, target_text, status, meta, jobs!inner(assigned_to, status)")
    .eq("id", segmentId)
    .maybeSingle();
  if (!seg) return { error: "Segment not found" as const };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = (seg as any).jobs as { assigned_to: string | null; status: string };
  const access = jobEditAccess(me, job);
  if (!access.ok) return { error: access.reason };
  const meta = (seg.meta ?? {}) as Record<string, unknown>;
  const location = meta.location as { kind?: string } | undefined;
  if (location?.kind !== "image_region") return { error: "This segment was not read from an image" as const };
  const history = (action: SegmentEditAction, after: { source_text?: string; target_text?: string; status?: string }) =>
    recordSegmentEdit({
      me,
      jobId: seg.job_id as string,
      jobStatus: job.status,
      segmentId: seg.id as string,
      seq: (seg.seq as number | null) ?? null,
      action,
      asStaff: access.asStaff,
      before: { source_text: seg.source_text as string, target_text: (seg.target_text as string) ?? "", status: seg.status as string },
      after,
    });
  return { supabase, seg, meta, history };
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
  const { supabase, seg, meta, history } = loaded;

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
  await history("correct_source", { source_text: text, target_text: (seg.target_text as string) ?? "", status: (update.status as string) ?? (seg.status as string) });

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
  const { supabase, seg, meta, history } = loaded;

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
  await history("illegible", { target_text: ILLEGIBLE_TARGET, status: "draft" });

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

const ExcludeSchema = z.object({ segment_id: z.string().uuid(), excluded: z.boolean() });
const EXCLUDED_TARGET = "[not part of the document]";

/**
 * Leaves a field out of the translation. The reading service also picks up
 * background security print and hologram text; those are not part of the
 * document's content. An excluded field counts as confirmed, is skipped by QA
 * and is left out of the draft and the certified document. It is not written
 * to the translation memory.
 */
export async function setFieldExcludedAction(input: { segment_id: string; excluded: boolean }): Promise<ImageActionResult> {
  const me = await getCurrentUser();
  const parsed = ExcludeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const loaded = await loadEditableSegment(parsed.data.segment_id, me);
  if ("error" in loaded) return { ok: false, error: loaded.error ?? "Not allowed" };
  const { supabase, seg, meta, history } = loaded;

  const nextMeta: Record<string, unknown> = { ...meta };
  let update: Record<string, unknown>;
  if (parsed.data.excluded) {
    nextMeta.excluded = { by: me.id, at: new Date().toISOString() };
    update = {
      target_text: EXCLUDED_TARGET,
      status: "translated",
      target_origin: "human",
      confirmed_by: me.id,
      confirmed_at: new Date().toISOString(),
      meta: nextMeta,
    };
  } else {
    delete nextMeta.excluded;
    update = { target_text: "", status: "untranslated", confirmed_by: null, confirmed_at: null, meta: nextMeta };
  }
  const { error } = await supabase.from("segments").update(update).eq("id", seg.id);
  if (error) return { ok: false, error: error.message };
  await history(parsed.data.excluded ? "exclude" : "include", {
    target_text: update.target_text as string,
    status: update.status as string,
  });

  await audit({
    category: "job",
    action: parsed.data.excluded ? "segment_excluded" : "segment_included",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "job",
    targetId: seg.job_id,
    meta: { segment_id: seg.id, seq: seg.seq },
  });
  return { ok: true };
}

const CommentsSchema = z.object({
  job_id: z.string().uuid(),
  comments: z.string().max(4000),
});

/**
 * Notes from the translator to the project manager. They are printed on an
 * internal last page of the certified document, which the PM removes before
 * the document is signed and delivered.
 */
export async function saveTranslatorCommentsAction(input: { job_id: string; comments: string }): Promise<ImageActionResult> {
  const me = await getCurrentUser();
  const parsed = CommentsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Comments are too long (4,000 characters at most)." };

  const supabase = await getServiceClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, assigned_to, reviewer_id, source_format, meta")
    .eq("id", parsed.data.job_id)
    .maybeSingle();
  if (!job) return { ok: false, error: "Job not found" };
  const allowed = job.assigned_to === me.id || job.reviewer_id === me.id || me.role === "admin" || me.role === "pm";
  if (!allowed) return { ok: false, error: "Not your job" };
  if (job.source_format !== "image") return { ok: false, error: "Comments are only kept for image jobs" };

  const meta = { ...((job.meta as Record<string, unknown> | null) ?? {}), translator_comments: parsed.data.comments.trim() };
  const { error } = await supabase.from("jobs").update({ meta }).eq("id", job.id);
  if (error) return { ok: false, error: error.message };

  await audit({
    category: "job",
    action: "translator_comments_saved",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "job",
    targetId: job.id,
    meta: { length: parsed.data.comments.trim().length },
  });
  return { ok: true };
}
