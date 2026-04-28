"use client";

import { useState, useTransition } from "react";
import { deliverAction } from "./qa-actions";

export function DeliverButton({
  jobId,
  jobClass,
  enabled,
  estimatedCostUsd,
  totalSegments,
}: {
  jobId: string;
  jobClass: "production" | "test";
  enabled: boolean;
  estimatedCostUsd: number;
  totalSegments: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    const isTest = jobClass === "test";
    const msg = isTest
      ? "Submit this test for grading? (No QA will run.)"
      : `Run QA and deliver?\n\n~${totalSegments} segments. Estimated cost: $${estimatedCostUsd.toFixed(2)}.`;
    if (!window.confirm(msg)) return;
    setError(null);
    startTransition(async () => {
      const res = await deliverAction(jobId);
      if (!res.ok) setError(res.error ?? "Deliver failed");
    });
  }

  if (!enabled) return null;

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[11px] text-[color:var(--color-rose-600)]">{error}</span>}
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="px-3 py-1.5 text-xs font-semibold rounded bg-[color:var(--color-navy)] text-white hover:bg-[color:var(--color-navy-700)] disabled:opacity-50"
      >
        {isPending ? "Working…" : jobClass === "test" ? "Submit test" : "Deliver"}
      </button>
    </div>
  );
}
