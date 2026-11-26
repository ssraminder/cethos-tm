import { getServiceClient } from "@/lib/supabase/server";
import { audit } from "@/lib/auth/audit";

/**
 * Who may change a job's segments, in one place, so the editor screen and
 * every server action agree.
 *
 * - Admins and PMs may edit any job that is not closed, cancelled or in the
 *   middle of a QA run, whoever it is assigned to and whatever stage it is
 *   at. Every such change is recorded in segment_edits (and the audit log
 *   when the job is not assigned to them), so the rights are auditable.
 * - The assigned translator may edit while the job is assigned, in progress
 *   or sent back for revision.
 * - Nobody else.
 */

export const ASSIGNEE_EDITABLE_STATUSES = ["assigned", "in_progress", "revision_requested"] as const;
export const STAFF_LOCKED_STATUSES = ["closed", "cancelled", "qa_running"] as const;

export type EditActor = { id: string; role: string; email?: string | null };
export type EditJob = { assigned_to: string | null; status: string };

export type EditAccess =
  | { ok: true; asStaff: boolean }
  | { ok: false; reason: string };

export function isStaffRole(role: string): boolean {
  return role === "admin" || role === "pm";
}

export function jobEditAccess(me: EditActor, job: EditJob): EditAccess {
  const isAssignee = !!job.assigned_to && job.assigned_to === me.id;
  if (isStaffRole(me.role)) {
    if ((STAFF_LOCKED_STATUSES as readonly string[]).includes(job.status)) {
      return { ok: false, reason: `Cannot edit a job in '${job.status}' status` };
    }
    // "asStaff" = editing someone else's (or nobody's) job by staff right.
    return { ok: true, asStaff: !isAssignee };
  }
  if (!isAssignee) return { ok: false, reason: "Not your job" };
  if (!(ASSIGNEE_EDITABLE_STATUSES as readonly string[]).includes(job.status)) {
    return { ok: false, reason: `Cannot edit a job in '${job.status}' status` };
  }
  return { ok: true, asStaff: false };
}

export type SegmentEditAction =
  | "save"
  | "confirm"
  | "clear"
  | "exclude"
  | "include"
  | "correct_source"
  | "illegible"
  | "qa_edit";

export type SegmentSnapshot = {
  source_text?: string | null;
  target_text?: string | null;
  status?: string | null;
};

/**
 * Append one row to segment_edits (append-only; a trigger blocks UPDATE and
 * DELETE). When staff edit a job that is not assigned to them, also write an
 * audit_log entry so the job's audit trail shows the intervention.
 * Never throws: a history failure is logged, not shown to the editor.
 */
export async function recordSegmentEdit(input: {
  me: EditActor;
  jobId: string;
  jobStatus: string;
  segmentId: string;
  seq: number | null;
  action: SegmentEditAction;
  asStaff: boolean;
  before: SegmentSnapshot;
  after: SegmentSnapshot;
}): Promise<void> {
  try {
    const supabase = await getServiceClient();
    const { error } = await supabase.from("segment_edits").insert({
      segment_id: input.segmentId,
      job_id: input.jobId,
      seq: input.seq,
      actor_id: input.me.id,
      actor_email: input.me.email ?? null,
      actor_role: input.me.role,
      as_staff: input.asStaff,
      action: input.action,
      job_status: input.jobStatus,
      before: input.before,
      after: input.after,
    });
    if (error) console.error("[segment_edits] insert failed", error.message);
  } catch (e) {
    console.error("[segment_edits] insert failed", e);
  }
  if (input.asStaff) {
    await audit({
      category: "job",
      action: "segment_edited_by_staff",
      actorId: input.me.id,
      actorEmail: input.me.email ?? null,
      targetType: "job",
      targetId: input.jobId,
      meta: { segment_id: input.segmentId, seq: input.seq, edit: input.action, job_status: input.jobStatus },
    });
  }
}
