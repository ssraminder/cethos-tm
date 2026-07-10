/**
 * Scheduled replay of missed test-submission callbacks.
 *
 * The deliver-time callback to the vendor portal (cvp-record-tm-submission)
 * is best-effort: if it fails after retries, the TM job stays 'submitted'
 * while the portal cvp_test_submissions row stays 'sent'/'viewed'/'expired'
 * and the applicant is never graded. This happened silently for ~313
 * submissions during the June 2026 ProZ-campaign surge.
 *
 * This route (Vercel cron, see vercel.json) closes the loop:
 *   1. Find TM jobs with job_class='test', status='submitted' and
 *      external_ref='test_submission:<uuid>'.
 *   2. Look up their cvp_test_submissions rows: directly via the portal
 *      service-role client when PORTAL_SUPABASE_SERVICE_ROLE_KEY is set,
 *      otherwise via the portal's cvp-tm-submission-status edge function
 *      (authed with the same PORTAL_TM_INBOUND_KEY as the record callback).
 *      Rows already 'submitted'/'assessed' are healthy; anything else means
 *      the callback was lost.
 *   3. Replay the callback with skipApplicantEmail=true. The portal endpoint
 *      is idempotent, so a race with a late-arriving original callback is
 *      harmless (alreadyRecorded=true).
 *   4. Log the run to tm_errors whenever anything was stuck, so silent loss
 *      shows up in the admin dashboard rather than only in Vercel logs.
 *
 * Auth: Vercel sends `Authorization: Bearer <CRON_SECRET>` when that env var
 * is set. Manual triggers may present CRON_SECRET or PORTAL_TM_INBOUND_KEY.
 * As a fallback (CRON_SECRET not yet provisioned) a request whose user-agent
 * is Vercel's cron runner is accepted — the route is idempotent and
 * non-destructive, so the residual spoofing risk is a wasted replay check.
 */

import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { logTmError } from "@/lib/errors/tm-errors";
import { getPortalClient, isPortalConfigured } from "@/lib/portal/client";
import {
  parseTestSubmissionId,
  recordTestSubmissionWithVendorPortal,
} from "@/lib/qa/record-test-submission";
import { getServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PORTAL_HEALTHY_STATUSES = new Set(["submitted", "assessed"]);
const PORTAL_QUERY_CHUNK = 200;
const DEFAULT_REPLAY_CAP = 40;
const MAX_REPLAY_CAP = 200;
const REPLAY_CONCURRENCY = 4;
// Stop launching new replay batches past this point so in-flight callbacks
// (each up to ~26s worst case with retries) still finish inside maxDuration.
const TIME_BUDGET_MS = 40_000;

interface CandidateJob {
  jobId: string;
  externalRef: string;
  submissionId: string;
}

function isAuthorized(req: Request): boolean {
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (env.cronSecret && bearer === env.cronSecret) return true;
  if (env.portal.tmInboundKey && bearer === env.portal.tmInboundKey) return true;
  const ua = req.headers.get("user-agent") ?? "";
  return ua.startsWith("vercel-cron/");
}

/**
 * Current cvp_test_submissions.status for each candidate. Prefers a direct
 * portal-DB read; falls back to the cvp-tm-submission-status edge function
 * when the service-role key isn't provisioned (as in TM's Vercel prod env,
 * which only holds the inbound shared secret). Throws with a short reason on
 * failure so the handler can surface it.
 */
async function fetchPortalStatuses(candidates: CandidateJob[]): Promise<Map<string, string>> {
  const statuses = new Map<string, string>();
  if (candidates.length === 0) return statuses;

  if (isPortalConfigured()) {
    const portal = getPortalClient();
    for (let i = 0; i < candidates.length; i += PORTAL_QUERY_CHUNK) {
      const chunk = candidates.slice(i, i + PORTAL_QUERY_CHUNK).map((c) => c.submissionId);
      const { data: rows, error } = await portal
        .from("cvp_test_submissions")
        .select("id, status")
        .in("id", chunk);
      if (error) throw new Error(`portal_query_failed: ${error.message}`);
      for (const r of (rows ?? []) as Array<{ id: string; status: string }>) {
        statuses.set(r.id, r.status);
      }
    }
    return statuses;
  }

  const portalUrl = (env.portal.url ?? "").replace(/\/$/, "");
  const inboundKey = env.portal.tmInboundKey;
  if (!portalUrl || !inboundKey) {
    throw new Error("portal_not_configured");
  }
  const resp = await fetch(`${portalUrl}/functions/v1/cvp-tm-submission-status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${inboundKey}`,
    },
    body: JSON.stringify({ submissionIds: candidates.map((c) => c.submissionId) }),
    signal: AbortSignal.timeout(30_000),
  });
  const json = (await resp.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    data?: { statuses?: Array<{ id: string; status: string }> };
  };
  if (!resp.ok || !json.success) {
    throw new Error(`portal_status_endpoint_failed: ${json.error ?? `http_${resp.status}`}`);
  }
  for (const r of json.data?.statuses ?? []) {
    statuses.set(r.id, r.status);
  }
  return statuses;
}

async function handle(req: Request): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const requestedCap = Number(url.searchParams.get("limit") ?? DEFAULT_REPLAY_CAP);
  const replayCap = Math.min(
    Number.isFinite(requestedCap) && requestedCap > 0 ? Math.floor(requestedCap) : DEFAULT_REPLAY_CAP,
    MAX_REPLAY_CAP,
  );
  const dryRun = url.searchParams.get("dryRun") === "1";
  const startedAt = Date.now();

  // 1) Submitted test jobs on the TM side.
  const supabase = await getServiceClient();
  const { data: jobs, error: jobsErr } = await supabase
    .from("jobs")
    .select("id, external_ref")
    .eq("job_class", "test")
    .eq("status", "submitted")
    .ilike("external_ref", "test_submission:%")
    .limit(2000);
  if (jobsErr) {
    return NextResponse.json({ ok: false, error: `jobs_query_failed: ${jobsErr.message}` }, { status: 500 });
  }

  const candidates: CandidateJob[] = [];
  for (const row of (jobs ?? []) as Array<{ id: string; external_ref: string | null }>) {
    const submissionId = parseTestSubmissionId(row.external_ref);
    if (submissionId) {
      candidates.push({ jobId: row.id, externalRef: row.external_ref!, submissionId });
    }
  }

  // 2) Portal-side status for each candidate.
  let portalStatus: Map<string, string>;
  try {
    portalStatus = await fetchPortalStatuses(candidates);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: message === "portal_not_configured" ? 503 : 502 },
    );
  }

  const stuck = candidates.filter((c) => {
    const status = portalStatus.get(c.submissionId);
    return status !== undefined && !PORTAL_HEALTHY_STATUSES.has(status);
  });
  const missingPortalRows = candidates.filter((c) => !portalStatus.get(c.submissionId));

  // 3) Replay, bounded by cap + time budget, in small concurrent batches.
  const toReplay = dryRun ? [] : stuck.slice(0, replayCap);
  const results: Array<{ jobId: string; submissionId: string; ok: boolean; reason?: string; alreadyRecorded?: boolean }> = [];
  let timedOut = false;
  for (let i = 0; i < toReplay.length; i += REPLAY_CONCURRENCY) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      timedOut = true;
      break;
    }
    const batch = toReplay.slice(i, i + REPLAY_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (c) => {
        const r = await recordTestSubmissionWithVendorPortal({
          jobId: c.jobId,
          externalRef: c.externalRef,
          skipApplicantEmail: true,
        });
        return {
          jobId: c.jobId,
          submissionId: c.submissionId,
          ok: r.ok,
          reason: r.reason,
          alreadyRecorded: r.alreadyRecorded,
        };
      }),
    );
    results.push(...batchResults);
  }

  const replayedOk = results.filter((r) => r.ok).length;
  const replayFailed = results.filter((r) => !r.ok).length;
  const summary = {
    ok: true,
    dryRun,
    checked: candidates.length,
    stuck: stuck.length,
    missingPortalRows: missingPortalRows.length,
    replayedOk,
    replayFailed,
    remainingStuck: stuck.length - replayedOk,
    timedOut,
    elapsedMs: Date.now() - startedAt,
    results,
    missing: missingPortalRows.map((c) => c.submissionId),
  };
  console.log("[replay-test-submissions]", JSON.stringify({ ...summary, results: results.length }));

  // 4) Any stuck row means an original callback was silently lost — leave a
  //    durable trace even when the replay fixed it.
  if (stuck.length > 0 || missingPortalRows.length > 0) {
    await logTmError({
      route: "api/cron/replay-test-submissions",
      action: "replay_run",
      severity: replayFailed > 0 ? "error" : "warn",
      message: `Found ${stuck.length} test submission(s) with a lost portal callback; replayed ${replayedOk}, failed ${replayFailed}${dryRun ? " (dry run)" : ""}${missingPortalRows.length ? `; ${missingPortalRows.length} portal row(s) missing` : ""}`,
      context: {
        checked: candidates.length,
        stuck: stuck.length,
        replayedOk,
        replayFailed,
        remainingStuck: stuck.length - replayedOk,
        missingPortalRows: missingPortalRows.map((c) => c.submissionId).slice(0, 50),
        failedSubmissionIds: results.filter((r) => !r.ok).map((r) => r.submissionId).slice(0, 50),
        dryRun,
        timedOut,
      },
    });
  }

  return NextResponse.json(summary);
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
