"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { findMatchesForSegment, type TmMatch } from "@/lib/tm/match";
import { translate, type MtSuggestion } from "@/lib/mt";

const SaveSchema = z.object({
  segment_id: z.string().uuid(),
  target_text: z.string().max(20_000),
  confirm: z.string().optional(),
});

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveSegmentAction(formData: FormData): Promise<SaveResult> {
  const me = await getCurrentUser();
  const parsed = SaveSchema.safeParse({
    segment_id: formData.get("segment_id"),
    target_text: formData.get("target_text"),
    confirm: formData.get("confirm") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { segment_id, target_text, confirm } = parsed.data!;
  const supabase = await getServiceClient();

  const { data: seg } = await supabase
    .from("segments")
    .select("id, job_id, status, jobs!inner(assigned_to, status)")
    .eq("id", segment_id)
    .maybeSingle();
  if (!seg) return { ok: false, error: "Segment not found" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = (seg as any).jobs;
  if (job.assigned_to !== me.id && me.role !== "admin" && me.role !== "pm") {
    return { ok: false, error: "Not your job" };
  }
  if (job.status !== "assigned" && job.status !== "in_progress") {
    return { ok: false, error: `Cannot edit a job in '${job.status}' status` };
  }

  const trimmed = target_text.trim();
  const wantConfirm = !!confirm && trimmed.length > 0;
  const newStatus = wantConfirm ? "translated" : trimmed.length > 0 ? "draft" : "untranslated";

  const update: Record<string, unknown> = { target_text: trimmed, status: newStatus };
  if (wantConfirm) {
    update.confirmed_by = me.id;
    update.confirmed_at = new Date().toISOString();
  } else {
    update.confirmed_by = null;
    update.confirmed_at = null;
  }

  const { error } = await supabase.from("segments").update(update).eq("id", segment_id);
  if (error) return { ok: false, error: error.message };

  if (job.status === "assigned" && trimmed.length > 0) {
    await supabase.from("jobs").update({ status: "in_progress" }).eq("id", seg!.job_id);
  }

  revalidatePath(`/translator/editor/${seg!.job_id}`);
  return { ok: true };
}

const FindSchema = z.object({
  job_id: z.string().uuid(),
  source_text: z.string().min(1).max(5_000),
});

export type FindResult = { ok: true; matches: TmMatch[] } | { ok: false; error: string };

export async function findMatchesAction(input: { job_id: string; source_text: string }): Promise<FindResult> {
  const me = await getCurrentUser();
  const parsed = FindSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  // Authorization: must be assigned to job OR staff
  const supabase = await getServiceClient();
  const { data: job } = await supabase.from("jobs").select("assigned_to, reviewer_id").eq("id", parsed.data!.job_id).maybeSingle();
  if (!job) return { ok: false, error: "Job not found" };
  const ok = job.assigned_to === me.id || job.reviewer_id === me.id || me.role === "admin" || me.role === "pm";
  if (!ok) return { ok: false, error: "Forbidden" };

  try {
    const matches = await findMatchesForSegment(parsed.data!.job_id, parsed.data!.source_text, 5);
    return { ok: true, matches };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Match failed" };
  }
}

export type MtResult = { ok: true; suggestion: MtSuggestion } | { ok: false; error: string };

const MtSchema = z.object({ segment_id: z.string().uuid() });

export async function getMtAction(input: { segment_id: string }): Promise<MtResult> {
  const me = await getCurrentUser();
  const parsed = MtSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const supabase = await getServiceClient();
  const { data: seg } = await supabase
    .from("segments")
    .select("id, job_id, source_text, jobs!inner(assigned_to, reviewer_id, source_lang, target_lang)")
    .eq("id", parsed.data!.segment_id)
    .maybeSingle();
  if (!seg) return { ok: false, error: "Segment not found" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = (seg as any).jobs;
  const ok = job.assigned_to === me.id || job.reviewer_id === me.id || me.role === "admin" || me.role === "pm";
  if (!ok) return { ok: false, error: "Forbidden" };

  try {
    const suggestion = await translate({
      source_text: seg.source_text,
      source_lang: job.source_lang,
      target_lang: job.target_lang,
    });
    // Persist on segment so the editor can show "MT used X%" and analytics can compute MT usage.
    await supabase.from("segments").update({
      mt_engine: suggestion.engine,
      mt_suggestion: suggestion.target_text,
    }).eq("id", parsed.data!.segment_id);
    return { ok: true, suggestion };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "MT failed" };
  }
}
