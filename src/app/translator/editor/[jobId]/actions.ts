"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";

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

  // Fetch segment + its job to enforce ownership.
  const { data: seg } = await supabase
    .from("segments")
    .select("id, job_id, status, jobs!inner(assigned_to, status)")
    .eq("id", segment_id)
    .maybeSingle();
  if (!seg) return { ok: false, error: "Segment not found" };

  // RLS-equivalent ownership check (we use service role here for simplicity)
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

  const update: Record<string, unknown> = {
    target_text: trimmed,
    status: newStatus,
  };
  if (wantConfirm) {
    update.confirmed_by = me.id;
    update.confirmed_at = new Date().toISOString();
  } else if (newStatus === "draft" || newStatus === "untranslated") {
    update.confirmed_by = null;
    update.confirmed_at = null;
  }

  const { error } = await supabase.from("segments").update(update).eq("id", segment_id);
  if (error) return { ok: false, error: error.message };

  // If job was 'assigned', flip to 'in_progress' on first edit.
  if (job.status === "assigned" && trimmed.length > 0) {
    await supabase.from("jobs").update({ status: "in_progress" }).eq("id", seg!.job_id);
  }

  revalidatePath(`/translator/editor/${seg!.job_id}`);
  return { ok: true };
}
