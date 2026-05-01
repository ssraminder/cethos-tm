/**
 * Test-submission callback to the vendor portal.
 *
 * When a translator delivers a test job (job_class='test'), TM-Cethos must
 * tell the vendor portal so it can flip cvp_test_submissions/combinations
 * status and fire AI grading. The link between the two systems is the
 * job's external_ref, which is set to "test_submission:<UUID>" at job
 * creation time (see src/app/api/admin/test-jobs/create/route.ts).
 *
 * This module assembles the translator's confirmed segments into a single
 * text blob (segment-aware grading is a later upgrade — for now the AI
 * grader expects one block of text) and POSTs to the vendor portal's
 * cvp-record-tm-submission edge function with a shared-secret bearer.
 *
 * Failure mode: this is best-effort. The translator's submit must not be
 * blocked if the vendor portal call fails — TM-side delivery state is the
 * source of truth, and a separate reconciliation can replay missed
 * callbacks. We log loudly and return ok=false so the caller can decide.
 */

import { env } from "@/lib/env";
import { getServiceClient } from "@/lib/supabase/server";

const TEST_SUBMISSION_REF_PREFIX = "test_submission:";

export interface RecordTestSubmissionResult {
  ok: boolean;
  reason?: string;
  submissionId?: string;
  alreadyRecorded?: boolean;
}

export function parseTestSubmissionId(externalRef: string | null | undefined): string | null {
  if (!externalRef) return null;
  if (!externalRef.startsWith(TEST_SUBMISSION_REF_PREFIX)) return null;
  const id = externalRef.slice(TEST_SUBMISSION_REF_PREFIX.length).trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  return id;
}

export async function buildSubmissionTextForJob(jobId: string): Promise<string> {
  const supabase = await getServiceClient();
  const { data: segs } = await supabase
    .from("segments")
    .select("seq, source_text, target_text")
    .eq("job_id", jobId)
    .order("seq", { ascending: true });
  const rows = (segs ?? []) as Array<{ seq: number; source_text: string; target_text: string | null }>;
  return rows
    .map((r) => (r.target_text ?? "").trim())
    .filter((t) => t.length > 0)
    .join("\n\n");
}

interface RecordArgs {
  jobId: string;
  externalRef: string | null;
  skipApplicantEmail?: boolean;
}

export async function recordTestSubmissionWithVendorPortal(
  args: RecordArgs,
): Promise<RecordTestSubmissionResult> {
  const submissionId = parseTestSubmissionId(args.externalRef);
  if (!submissionId) {
    return { ok: false, reason: "no_test_submission_id_in_external_ref" };
  }

  const portalUrl = (env.portal.url ?? "").replace(/\/$/, "");
  const inboundKey = env.portal.tmInboundKey;
  if (!portalUrl || !inboundKey) {
    return { ok: false, reason: "vendor_portal_callback_not_configured" };
  }

  const submittedContent = await buildSubmissionTextForJob(args.jobId);
  if (!submittedContent) {
    return { ok: false, reason: "no_translated_segments" };
  }

  try {
    const resp = await fetch(`${portalUrl}/functions/v1/cvp-record-tm-submission`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${inboundKey}`,
      },
      body: JSON.stringify({
        submissionId,
        submittedContent,
        tmJobId: args.jobId,
        skipApplicantEmail: args.skipApplicantEmail === true,
      }),
    });
    const json = (await resp.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      data?: { submissionId?: string; alreadyRecorded?: boolean };
    };
    if (!resp.ok || !json.success) {
      console.error("cvp-record-tm-submission failed", {
        jobId: args.jobId,
        submissionId,
        status: resp.status,
        body: json,
      });
      return {
        ok: false,
        reason: json.error ?? `http_${resp.status}`,
        submissionId,
      };
    }
    return {
      ok: true,
      submissionId,
      alreadyRecorded: json.data?.alreadyRecorded === true,
    };
  } catch (err) {
    console.error("cvp-record-tm-submission threw", {
      jobId: args.jobId,
      submissionId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, reason: "fetch_threw", submissionId };
  }
}
