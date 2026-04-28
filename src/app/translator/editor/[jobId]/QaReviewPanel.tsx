"use client";

import { useState, useTransition } from "react";
import {
  acceptFindingAction,
  rejectFindingAction,
  editAndResolveFindingAction,
  confirmDelivery,
} from "./qa-actions";

export interface QaReviewFinding {
  id: string;
  segment_id: string;
  segment_seq: number;
  source_text: string;
  target_text: string;
  rule: string;
  severity: "critical" | "major" | "minor";
  category: string | null;
  message: string;
  source: string;
  suggested_target: string | null;
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-[color:var(--color-rose-600)] text-white",
  major: "bg-[color:var(--color-amber-500)] text-white",
  minor: "bg-[color:var(--color-slate-300)] text-[color:var(--color-slate-700)]",
};

export function QaReviewPanel({
  jobId,
  findings,
  unresolvedCriticalCount,
}: {
  jobId: string;
  findings: QaReviewFinding[];
  unresolvedCriticalCount: number;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function runAction(findingId: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setPendingId(findingId);
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Action failed");
      setPendingId(null);
    });
  }

  function onAccept(f: QaReviewFinding) {
    const fd = new FormData();
    fd.set("finding_id", f.id);
    runAction(f.id, () => acceptFindingAction(fd));
  }

  function onReject(f: QaReviewFinding) {
    const note = window.prompt("Optional note (why are you rejecting this?)") ?? "";
    const fd = new FormData();
    fd.set("finding_id", f.id);
    if (note) fd.set("note", note);
    runAction(f.id, () => rejectFindingAction(fd));
  }

  function onEdit(f: QaReviewFinding) {
    const newTarget = window.prompt("Edit target text:", f.target_text);
    if (newTarget === null || newTarget.trim().length === 0) return;
    const fd = new FormData();
    fd.set("finding_id", f.id);
    fd.set("new_target", newTarget);
    runAction(f.id, () => editAndResolveFindingAction(fd));
  }

  function onConfirmDelivery() {
    if (!window.confirm("Confirm delivery? This will finalize the job.")) return;
    setError(null);
    startTransition(async () => {
      const res = await confirmDelivery(jobId);
      if (!res.ok) setError(res.error ?? "Could not confirm delivery");
    });
  }

  const counts = { critical: 0, major: 0, minor: 0 };
  for (const f of findings) counts[f.severity]++;

  return (
    <div className="bg-white border-b border-[color:var(--color-border)]">
      <div className="px-4 py-3 flex items-center gap-3 border-b border-[color:var(--color-border-soft)]">
        <span className="text-sm font-bold text-[color:var(--color-navy)]">QA review</span>
        <span className="text-xs text-[color:var(--color-slate-500)]">
          {counts.critical} critical · {counts.major} major · {counts.minor} minor
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onConfirmDelivery}
          disabled={unresolvedCriticalCount > 0}
          className="px-3 py-1.5 text-xs font-semibold rounded bg-[color:var(--color-emerald-600)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            unresolvedCriticalCount > 0
              ? `${unresolvedCriticalCount} critical finding(s) must be resolved first`
              : "Finalize delivery"
          }
        >
          Confirm delivery
        </button>
      </div>
      {error && (
        <div className="px-4 py-2 text-xs text-[color:var(--color-rose-600)] bg-[color:var(--color-rose-50)]">
          {error}
        </div>
      )}
      {findings.length === 0 ? (
        <div className="px-4 py-3 text-xs text-[color:var(--color-slate-500)] italic">
          No open findings — ready to deliver.
        </div>
      ) : (
        <ul className="max-h-64 overflow-y-auto divide-y divide-[color:var(--color-border-soft)]">
          {findings.map((f) => (
            <li key={f.id} className="px-4 py-2 text-xs">
              <div className="flex items-start gap-2">
                <span
                  className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wide text-[10px] ${SEVERITY_BADGE[f.severity]}`}
                >
                  {f.severity}
                </span>
                <span className="text-[10px] text-[color:var(--color-slate-500)] uppercase">
                  {f.source} · {f.category ?? f.rule}
                </span>
                <span className="text-[10px] text-[color:var(--color-slate-500)]">#{f.segment_seq}</span>
              </div>
              <div className="mt-1 text-[color:var(--color-slate-700)]">{f.message}</div>
              {f.suggested_target && (
                <div className="mt-1 rounded bg-[color:var(--color-emerald-50)] border border-[color:var(--color-emerald-200)] p-1.5 mono text-[11px] text-[color:var(--color-emerald-800)]">
                  <span className="text-[10px] font-bold text-[color:var(--color-emerald-700)] mr-1">Suggested:</span>
                  {f.suggested_target}
                </div>
              )}
              <div className="mt-1.5 flex gap-1.5">
                {f.suggested_target && (
                  <button
                    type="button"
                    onClick={() => onAccept(f)}
                    disabled={pendingId === f.id}
                    className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[color:var(--color-emerald-600)] text-white disabled:opacity-50"
                  >
                    Accept
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onEdit(f)}
                  disabled={pendingId === f.id}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white border border-[color:var(--color-slate-200)] hover:bg-[color:var(--color-slate-50)] disabled:opacity-50"
                >
                  Edit & save
                </button>
                <button
                  type="button"
                  onClick={() => onReject(f)}
                  disabled={pendingId === f.id}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold text-[color:var(--color-slate-600)] hover:bg-[color:var(--color-slate-100)] disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
