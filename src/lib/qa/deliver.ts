/**
 * Deliver pipeline orchestrator.
 *
 * Two SEPARATE entry points (translator-facing as two distinct buttons):
 *
 *   runQa(jobId)
 *     - Allowed from: assigned, in_progress, qa_review (re-run)
 *     - Status flow: <current> → qa_running → qa_review
 *     - Runs deterministic QA, then Opus QA (if env + job toggle allow)
 *     - Translator can re-run after fixing things
 *
 *   finalizeDelivery(jobId)
 *     - Allowed from: assigned, in_progress, qa_review
 *     - Status flow: → delivered (or → submitted for test jobs)
 *     - Gate: no unresolved CRITICAL findings (whether deterministic or Opus)
 *     - Per-job toggle jobs.qa_enabled controls whether Run QA is offered;
 *       Deliver itself is always available once segments are confirmed
 *
 * Test jobs (job_class='test') ignore Run QA entirely and submit straight
 * to grading.
 */

import { getServiceClient } from "@/lib/supabase/server";
import { runQaForJob } from "./run";
import { runOpusQa, mapOpusSeverity, type OpusFinding } from "./opus";

export interface QaRunResult {
  ok: true;
  status: string;
  deterministic: { inserted: number; findings_by_severity: Record<string, number> };
  opus?: {
    inserted: number;
    cost_usd: number;
    aborted: boolean;
    skipped_reason?: string;
  };
}

export interface DeliveryResult {
  ok: true;
  status: string;
  job_class: "production" | "test";
}

export interface ActionError {
  ok: false;
  error: string;
}

async function loadJob(jobId: string) {
  const supabase = await getServiceClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, source_lang, target_lang, job_class, qa_enabled, assigned_to")
    .eq("id", jobId)
    .maybeSingle();
  return { supabase, job };
}

async function assertAllConfirmed(jobId: string): Promise<string | null> {
  const supabase = await getServiceClient();
  const { data: openSegs } = await supabase
    .from("segments")
    .select("id")
    .eq("job_id", jobId)
    .in("status", ["untranslated", "draft"]);
  if ((openSegs ?? []).length > 0) {
    return `${openSegs!.length} segment(s) not yet confirmed`;
  }
  return null;
}

/**
 * Run QA only — does NOT deliver. Lands in qa_review for translator triage.
 */
export async function runQa(jobId: string, triggeredBy: string): Promise<QaRunResult | ActionError> {
  const { supabase, job } = await loadJob(jobId);
  if (!job) return { ok: false, error: "Job not found" };

  if (!["assigned", "in_progress", "qa_review"].includes(job.status)) {
    return { ok: false, error: `Cannot run QA from status '${job.status}'` };
  }
  if (job.job_class === "test") {
    return { ok: false, error: "QA is not available on test jobs" };
  }
  if (job.qa_enabled === false) {
    return { ok: false, error: "QA is disabled on this job" };
  }
  const blocker = await assertAllConfirmed(jobId);
  if (blocker) return { ok: false, error: blocker };

  await supabase.from("jobs").update({ status: "qa_running" }).eq("id", jobId);

  const deterministic = await runQaForJob(jobId);

  const opusEnabled = (process.env.QA_ENABLED ?? "true").toLowerCase() !== "false";
  let opusBlock: QaRunResult["opus"] | undefined;

  if (!opusEnabled) {
    opusBlock = { inserted: 0, cost_usd: 0, aborted: false, skipped_reason: "QA_ENABLED=false" };
  } else if ((deterministic.findings_by_severity.critical ?? 0) > 0) {
    opusBlock = {
      inserted: 0,
      cost_usd: 0,
      aborted: false,
      skipped_reason: "deterministic critical findings present — fix those first",
    };
  } else {
    opusBlock = await runOpusPass(jobId, job, triggeredBy);
  }

  await supabase.from("jobs").update({ status: "qa_review" }).eq("id", jobId);

  return {
    ok: true,
    status: "qa_review",
    deterministic: {
      inserted: deterministic.inserted,
      findings_by_severity: deterministic.findings_by_severity,
    },
    opus: opusBlock,
  };
}

/**
 * Deliver — flips status to delivered (or submitted for test jobs).
 * Independent of QA. Only gates on unresolved critical findings.
 */
export async function finalizeDelivery(jobId: string, userId: string): Promise<DeliveryResult | ActionError> {
  const { supabase, job } = await loadJob(jobId);
  if (!job) return { ok: false, error: "Job not found" };

  if (!["assigned", "in_progress", "qa_review"].includes(job.status)) {
    return { ok: false, error: `Cannot deliver from status '${job.status}'` };
  }
  if (job.assigned_to !== userId) {
    return { ok: false, error: "Not your job" };
  }
  const blocker = await assertAllConfirmed(jobId);
  if (blocker) return { ok: false, error: blocker };

  // Test jobs short-circuit to submitted.
  if (job.job_class === "test") {
    await supabase.from("jobs").update({ status: "submitted" }).eq("id", jobId);
    return { ok: true, status: "submitted", job_class: "test" };
  }

  // Production: block if there are unresolved critical findings (regardless
  // of state). If translator never ran QA, there are no findings → no gate.
  const segIds = ((await supabase.from("segments").select("id").eq("job_id", jobId)).data ?? []).map(
    (r) => r.id,
  );
  if (segIds.length > 0) {
    const { data: blockers } = await supabase
      .from("qa_findings")
      .select("id")
      .in("segment_id", segIds)
      .eq("severity", "critical")
      .eq("ignored", false)
      .is("resolved_at", null);
    if ((blockers ?? []).length > 0) {
      return {
        ok: false,
        error: `${blockers!.length} critical finding(s) unresolved — accept, edit, or reject them first`,
      };
    }
  }

  await supabase.from("jobs").update({ status: "delivered" }).eq("id", jobId);
  return { ok: true, status: "delivered", job_class: "production" };
}

async function runOpusPass(
  jobId: string,
  job: { source_lang: string; target_lang: string },
  triggeredBy: string,
): Promise<QaRunResult["opus"]> {
  const supabase = await getServiceClient();

  if (!process.env.ANTHROPIC_API_KEY) {
    return { inserted: 0, cost_usd: 0, aborted: false, skipped_reason: "ANTHROPIC_API_KEY not set" };
  }

  const { data: run } = await supabase
    .from("qa_runs")
    .insert({
      job_id: jobId,
      triggered_by: triggeredBy,
      model: "claude-opus-4-7",
      status: "running",
    })
    .select("id")
    .single();
  if (!run) return { inserted: 0, cost_usd: 0, aborted: false, skipped_reason: "could not open qa_runs row" };

  try {
    const { data: segs } = await supabase
      .from("segments")
      .select("id, source_text, target_text")
      .eq("job_id", jobId)
      .in("status", ["translated", "reviewed"])
      .order("seq", { ascending: true });

    if (!segs || segs.length === 0) {
      await supabase
        .from("qa_runs")
        .update({ status: "completed", finished_at: new Date().toISOString() })
        .eq("id", run.id);
      return { inserted: 0, cost_usd: 0, aborted: false };
    }

    const { data: tbRows } = await supabase
      .from("job_resources")
      .select("resource_id")
      .eq("job_id", jobId)
      .eq("resource_type", "termbase");
    const tbIds = (tbRows ?? []).map((r) => r.resource_id);
    const glossary: Array<{ source: string; target: string; status?: string }> = [];
    if (tbIds.length > 0) {
      const { data: terms } = await supabase
        .from("term_concepts")
        .select("entries:term_entries!inner(text, lang, status)")
        .in("termbase_id", tbIds);
      for (const c of (terms ?? []) as Array<{ entries: Array<{ text: string; lang: string; status: string }> }>) {
        const src = c.entries.find((e) => e.lang.toLowerCase().startsWith(job.source_lang.toLowerCase().slice(0, 2)));
        const tgt = c.entries.find((e) => e.lang.toLowerCase().startsWith(job.target_lang.toLowerCase().slice(0, 2)));
        if (src && tgt) glossary.push({ source: src.text, target: tgt.text, status: tgt.status });
      }
    }

    const segments = segs.map((s) => ({ id: s.id, source: s.source_text, target: s.target_text }));

    const result = await runOpusQa({
      sourceLang: job.source_lang,
      targetLang: job.target_lang,
      glossary,
      segments,
    });

    if (result.findings.length > 0) {
      const rows = result.findings.map((f: OpusFinding) => ({
        segment_id: f.segment_id,
        rule: `opus_${f.category}`,
        severity: mapOpusSeverity(f.severity),
        message: f.message,
        run_id: run.id,
        source: "opus",
        category: f.category,
        suggested_target: f.suggested_target ?? null,
      }));
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        await supabase.from("qa_findings").insert(rows.slice(i, i + CHUNK));
      }
    }

    await supabase
      .from("qa_runs")
      .update({
        status: result.aborted ? "aborted_cost_cap" : "completed",
        finished_at: new Date().toISOString(),
        input_tokens: result.usage.input_tokens,
        cached_tokens: result.usage.cached_tokens,
        output_tokens: result.usage.output_tokens,
        cost_usd: result.cost_usd,
      })
      .eq("id", run.id);

    return { inserted: result.findings.length, cost_usd: result.cost_usd, aborted: result.aborted };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("qa_runs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error_message: msg })
      .eq("id", run.id);
    return { inserted: 0, cost_usd: 0, aborted: false, skipped_reason: `opus failed: ${msg}` };
  }
}
