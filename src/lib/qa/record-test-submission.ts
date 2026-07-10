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
 * source of truth. The call retries with exponential backoff (non-2xx and
 * fetch exceptions are both retryable; the portal endpoint is idempotent),
 * and a final failure is written to tm_errors so it is visible in the admin
 * dashboard instead of only in function logs. The scheduled replay job
 * (/api/cron/replay-test-submissions) picks up anything that still slips
 * through.
 */

import { env } from "@/lib/env";
import { logTmError } from "@/lib/errors/tm-errors";
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

// Retry tuning. The callback runs inside the translator's deliver request
// (and inside the replay cron), so the worst case must stay well under the
// route's execution ceiling: 3 attempts × 8s timeout + 0.5s + 1s backoff.
// The typical failure (portal returns 5xx quickly) only costs ~1.5s extra.
const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 8_000;
const BACKOFF_BASE_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface PortalResponse {
  success?: boolean;
  error?: string;
  data?: { submissionId?: string; alreadyRecorded?: boolean };
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

  let lastReason = "unknown";
  let lastStatus: number | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
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
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });
      const json = (await resp.json().catch(() => ({}))) as PortalResponse;
      if (resp.ok && json.success) {
        if (attempt > 1) {
          // Recovered after a failed attempt — leave a warn-level trace so we
          // can see how often the portal needs retries.
          await logTmError({
            route: "qa/record-test-submission",
            action: "portal_callback_recovered",
            severity: "warn",
            message: `cvp-record-tm-submission succeeded on attempt ${attempt}/${MAX_ATTEMPTS} (previous failure: ${lastReason})`,
            context: { attempt, lastReason, lastStatus },
            test_submission_id: submissionId,
            job_id: args.jobId,
          });
        }
        return {
          ok: true,
          submissionId,
          alreadyRecorded: json.data?.alreadyRecorded === true,
        };
      }
      // Non-2xx (or 2xx without success:true) — retryable. Even 4xx responses
      // are worth retrying here: they are cheap, and transient states like a
      // portal deploy or a not-yet-visible submission row can clear up.
      lastReason = json.error ?? `http_${resp.status}`;
      lastStatus = resp.status;
      console.error("cvp-record-tm-submission failed", {
        jobId: args.jobId,
        submissionId,
        attempt,
        status: resp.status,
        body: json,
      });
    } catch (err) {
      lastReason = err instanceof Error && err.name === "TimeoutError" ? "fetch_timeout" : "fetch_threw";
      lastStatus = null;
      console.error("cvp-record-tm-submission threw", {
        jobId: args.jobId,
        submissionId,
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    if (attempt < MAX_ATTEMPTS) {
      await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
    }
  }

  // All attempts exhausted — record durably so the loss is visible in the
  // admin dashboard (tm_errors), not just in ephemeral function logs. The
  // replay cron will pick this submission up as long as the job stays
  // status='submitted' and the portal row is not submitted/assessed.
  await logTmError({
    route: "qa/record-test-submission",
    action: "portal_callback_failed",
    severity: "error",
    message: `cvp-record-tm-submission failed after ${MAX_ATTEMPTS} attempts: ${lastReason}`,
    context: {
      attempts: MAX_ATTEMPTS,
      lastReason,
      lastStatus,
      skipApplicantEmail: args.skipApplicantEmail === true,
    },
    test_submission_id: submissionId,
    job_id: args.jobId,
  });
  return { ok: false, reason: lastReason, submissionId };
}
