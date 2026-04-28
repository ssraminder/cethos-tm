/**
 * Deliver pipeline orchestrator.
 *
 * Flow:
 *   in_progress → qa_running → qa_review → delivered (production)
 *   in_progress → submitted                          (test, no QA)
 *
 * For production:
 *   1. Run deterministic QA (existing runQaForJob — clears unresolved auto-findings, re-inserts).
 *   2. Open a qa_runs row.
 *   3. If QA_ENABLED env is true and there are no critical deterministic
 *      blockers, run Opus on the segments. Insert opus findings linked to
 *      run_id with source='opus'.
 *   4. Flip job.status to 'qa_review'. Translator reviews findings.
 *
 * confirmDelivery is a separate action that flips qa_review → delivered
 * once all critical findings are resolved.
 */

import { getServiceClient } from "@/lib/supabase/server";
import { runQaForJob } from "./run";
import { runOpusQa, mapOpusSeverity, type OpusFinding } from "./opus";

export interface DeliverResult {
  ok: true;
  job_class: "production" | "test";
  status: string;
  deterministic: { inserted: number; findings_by_severity: Record<string, number> };
  opus?: {
    inserted: number;
    cost_usd: number;
    aborted: boolean;
    skipped_reason?: string;
  };
}

export interface DeliverError {
  ok: false;
  error: string;
}

export async function runDeliver(
  jobId: string,
  triggeredBy: string,
): Promise<DeliverResult | DeliverError> {
  const supabase = await getServiceClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, source_lang, target_lang, job_class, assigned_to")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { ok: false, error: "Job not found" };

  if (job.status !== "in_progress" && job.status !== "assigned") {
    return { ok: false, error: `Cannot deliver from status '${job.status}'` };
  }

  const { data: openSegs } = await supabase
    .from("segments")
    .select("id")
    .eq("job_id", jobId)
    .in("status", ["untranslated", "draft"]);
  if ((openSegs ?? []).length > 0) {
    return { ok: false, error: `${openSegs!.length} segment(s) not yet confirmed` };
  }

  // Test jobs short-circuit: no QA, just submit.
  if (job.job_class === "test") {
    await supabase.from("jobs").update({ status: "submitted" }).eq("id", jobId);
    return {
      ok: true,
      job_class: "test",
      status: "submitted",
      deterministic: { inserted: 0, findings_by_severity: {} },
    };
  }

  // Production path.
  await supabase.from("jobs").update({ status: "qa_running" }).eq("id", jobId);

  const deterministic = await runQaForJob(jobId);

  const qaEnabled = (process.env.QA_ENABLED ?? "true").toLowerCase() !== "false";
  let opusBlock: DeliverResult["opus"] | undefined;

  if (!qaEnabled) {
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
    job_class: "production",
    status: "qa_review",
    deterministic: {
      inserted: deterministic.inserted,
      findings_by_severity: deterministic.findings_by_severity,
    },
    opus: opusBlock,
  };
}

async function runOpusPass(
  jobId: string,
  job: { source_lang: string; target_lang: string },
  triggeredBy: string,
): Promise<DeliverResult["opus"]> {
  const supabase = await getServiceClient();

  if (!process.env.ANTHROPIC_API_KEY) {
    return { inserted: 0, cost_usd: 0, aborted: false, skipped_reason: "ANTHROPIC_API_KEY not set" };
  }

  // Open the run row.
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
    // Pull segments + glossary.
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

    // Attached termbases → flat glossary.
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

    // Insert findings.
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

export async function confirmDeliveryAction(jobId: string, userId: string): Promise<DeliverResult | DeliverError> {
  const supabase = await getServiceClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, assigned_to, job_class")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { ok: false, error: "Job not found" };
  if (job.status !== "qa_review") {
    return { ok: false, error: `Can only confirm delivery from 'qa_review' (got '${job.status}')` };
  }
  if (job.assigned_to !== userId) {
    return { ok: false, error: "Not your job" };
  }

  // Gate: no unresolved critical findings.
  const { data: blockers } = await supabase
    .from("qa_findings")
    .select("id, segment_id")
    .in(
      "segment_id",
      ((await supabase.from("segments").select("id").eq("job_id", jobId)).data ?? []).map((r) => r.id),
    )
    .eq("severity", "critical")
    .eq("ignored", false)
    .is("resolved_at", null);
  if ((blockers ?? []).length > 0) {
    return { ok: false, error: `${blockers!.length} critical finding(s) still unresolved` };
  }

  await supabase.from("jobs").update({ status: "delivered" }).eq("id", jobId);

  return {
    ok: true,
    job_class: job.job_class ?? "production",
    status: "delivered",
    deterministic: { inserted: 0, findings_by_severity: {} },
  };
}
