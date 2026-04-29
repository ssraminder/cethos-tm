"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { runQa, finalizeDelivery } from "@/lib/qa/deliver";
import { upsertTmUnit } from "@/lib/tm/default-tm";

export type ActionResult<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

export async function runQaAction(jobId: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  const result = await runQa(jobId, me.id);
  if (result.ok) revalidatePath(`/translator/editor/${jobId}`);
  return result;
}

export async function deliverAction(jobId: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  const result = await finalizeDelivery(jobId, me.id);
  if (result.ok) revalidatePath(`/translator/editor/${jobId}`);
  return result;
}

/** @deprecated alias kept so existing callers don't break — same as deliverAction */
export const confirmDelivery = deliverAction;

const FindingActionSchema = z.object({
  finding_id: z.string().uuid(),
  note: z.string().max(2000).optional(),
});

interface FindingContext {
  finding: { id: string; segment_id: string; suggested_target: string | null };
  segment: { id: string; job_id: string; source_text: string };
  job: { id: string; assigned_to: string | null; status: string; source_lang: string; target_lang: string };
}

async function loadFindingForAction(
  findingId: string,
  userId: string,
): Promise<FindingContext | { error: string }> {
  const supabase = await getServiceClient();
  const { data: f } = await supabase
    .from("qa_findings")
    .select("id, segment_id, suggested_target")
    .eq("id", findingId)
    .maybeSingle();
  if (!f) return { error: "Finding not found" };

  const { data: seg } = await supabase
    .from("segments")
    .select("id, job_id, source_text")
    .eq("id", f.segment_id)
    .maybeSingle();
  if (!seg) return { error: "Segment not found" };

  const { data: job } = await supabase
    .from("jobs")
    .select("id, assigned_to, status, source_lang, target_lang")
    .eq("id", seg.job_id)
    .maybeSingle();
  if (!job) return { error: "Job not found" };

  if (job.assigned_to !== userId) return { error: "Not your job" };
  if (job.status !== "qa_review") return { error: `Cannot act on findings in '${job.status}'` };

  return { finding: f as FindingContext["finding"], segment: seg as FindingContext["segment"], job: job as FindingContext["job"] };
}

async function writeTmForFix(args: {
  jobId: string;
  segmentId: string;
  sourceText: string;
  newTarget: string;
  sourceLang: string;
  targetLang: string;
  userId: string;
}): Promise<void> {
  const supabase = await getServiceClient();
  const { data: attached } = await supabase
    .from("job_resources")
    .select("resource_id")
    .eq("job_id", args.jobId)
    .eq("resource_type", "tm");
  const tmIds = (attached ?? []).map((r) => (r as { resource_id: string }).resource_id);
  const provenance = {
    job_id: args.jobId,
    segment_id: args.segmentId,
    source_lang: args.sourceLang,
    target_lang: args.targetLang,
    confirmed_by: args.userId,
    confirmed_at: new Date().toISOString(),
  };
  await Promise.all(
    tmIds.map((tm_id) =>
      upsertTmUnit({ tm_id, source_text: args.sourceText, target_text: args.newTarget, provenance }),
    ),
  );
}

export async function acceptFindingAction(formData: FormData): Promise<ActionResult> {
  const me = await getCurrentUser();
  const parsed = FindingActionSchema.safeParse({ finding_id: formData.get("finding_id") });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const ctx = await loadFindingForAction(parsed.data.finding_id, me.id);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { finding, segment, job } = ctx;

  const suggested = finding.suggested_target;
  if (!suggested || suggested.trim().length === 0) {
    return { ok: false, error: "No suggested target on this finding" };
  }

  const supabase = await getServiceClient();
  await supabase
    .from("segments")
    .update({ target_text: suggested, target_origin: "tm_edited" })
    .eq("id", segment.id);

  await writeTmForFix({
    jobId: job.id,
    segmentId: segment.id,
    sourceText: segment.source_text,
    newTarget: suggested,
    sourceLang: job.source_lang,
    targetLang: job.target_lang,
    userId: me.id,
  });

  await supabase
    .from("qa_findings")
    .update({ resolved_at: new Date().toISOString(), reviewer_action: "accept" })
    .eq("id", parsed.data.finding_id);

  revalidatePath(`/translator/editor/${job.id}`);
  return { ok: true };
}

export async function rejectFindingAction(formData: FormData): Promise<ActionResult> {
  const me = await getCurrentUser();
  const parsed = FindingActionSchema.safeParse({
    finding_id: formData.get("finding_id"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const ctx = await loadFindingForAction(parsed.data.finding_id, me.id);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { job } = ctx;

  const supabase = await getServiceClient();
  await supabase
    .from("qa_findings")
    .update({
      resolved_at: new Date().toISOString(),
      reviewer_action: "reject",
      reviewer_note: parsed.data.note ?? null,
    })
    .eq("id", parsed.data.finding_id);

  revalidatePath(`/translator/editor/${job.id}`);
  return { ok: true };
}

const EditFindingSchema = z.object({
  finding_id: z.string().uuid(),
  new_target: z.string().min(1).max(20_000),
});

export async function editAndResolveFindingAction(formData: FormData): Promise<ActionResult> {
  const me = await getCurrentUser();
  const parsed = EditFindingSchema.safeParse({
    finding_id: formData.get("finding_id"),
    new_target: formData.get("new_target"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const ctx = await loadFindingForAction(parsed.data.finding_id, me.id);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { segment, job } = ctx;

  const supabase = await getServiceClient();
  await supabase
    .from("segments")
    .update({ target_text: parsed.data.new_target, target_origin: "tm_edited" })
    .eq("id", segment.id);

  await writeTmForFix({
    jobId: job.id,
    segmentId: segment.id,
    sourceText: segment.source_text,
    newTarget: parsed.data.new_target,
    sourceLang: job.source_lang,
    targetLang: job.target_lang,
    userId: me.id,
  });

  await supabase
    .from("qa_findings")
    .update({ resolved_at: new Date().toISOString(), reviewer_action: "edit" })
    .eq("id", parsed.data.finding_id);

  revalidatePath(`/translator/editor/${job.id}`);
  return { ok: true };
}
