"use client";

import { useState, useTransition } from "react";
import { runQaAction, deliverAction } from "./qa-actions";

/**
 * Two separate translator-facing actions:
 *   - "Run QA" — runs deterministic + Opus, lands in qa_review for triage.
 *     Shown only when jobs.qa_enabled is true and the job isn't a test.
 *   - "Deliver" — finalizes the job (status -> delivered, or submitted for
 *     test jobs). Independent of QA but blocked if any unresolved critical
 *     finding exists.
 */
export function DeliverButton({
  jobId,
  jobClass,
  qaEnabled,
  enabled,
  totalSegments,
  inQaRunning,
}: {
  jobId: string;
  jobClass: "production" | "test";
  qaEnabled: boolean;
  enabled: boolean;
  totalSegments: number;
  inQaRunning: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onRunQa() {
    if (!window.confirm(`Run AI QA on ${totalSegments} segment${totalSegments === 1 ? "" : "s"}?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await runQaAction(jobId);
      if (!res.ok) setError(res.error ?? "QA run failed");
    });
  }

  function onDeliver() {
    const isTest = jobClass === "test";
    const msg = isTest
      ? "Submit this test for grading?"
      : `Deliver this job? ${totalSegments} segment${totalSegments === 1 ? "" : "s"}.`;
    if (!window.confirm(msg)) return;
    setError(null);
    startTransition(async () => {
      const res = await deliverAction(jobId);
      if (!res.ok) setError(res.error ?? "Deliver failed");
    });
  }

  if (!enabled) return null;
  const showRunQa = qaEnabled && jobClass !== "test" && !inQaRunning;

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[11px] text-[color:var(--color-rose-600)]">{error}</span>}
      {showRunQa && (
        <button
          type="button"
          onClick={onRunQa}
          disabled={isPending}
          className="px-3 py-1.5 text-xs font-semibold rounded border border-[color:var(--color-slate-200)] bg-white text-[color:var(--color-slate-700)] hover:bg-[color:var(--color-slate-50)] disabled:opacity-50"
          title="Run rule-based + AI QA review before delivery"
        >
          {isPending ? "Working…" : "Run QA"}
        </button>
      )}
      <button
        type="button"
        onClick={onDeliver}
        disabled={isPending || inQaRunning}
        className="px-3 py-1.5 text-xs font-semibold rounded bg-[color:var(--color-navy)] text-white hover:bg-[color:var(--color-navy-700)] disabled:opacity-50"
      >
        {isPending ? "Working…" : jobClass === "test" ? "Submit test" : "Deliver"}
      </button>
    </div>
  );
}
