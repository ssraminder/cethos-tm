"use client";

import { useEffect, useState, useTransition } from "react";
import { findMatchesAction } from "./actions";
import type { TmMatch } from "@/lib/tm/match";

/**
 * Bottom split panel — shows TM matches for the currently-active segment.
 *
 * When `activeSegmentId` changes the panel kicks off a fresh
 * findMatchesAction lookup. Buttons (Insert / Insert & confirm) emit a
 * window CustomEvent('cethos-tm:insert-match', { detail: { segmentId,
 * match, andConfirm } }) which the corresponding SegmentRow listens for
 * and applies — keeps SegmentRow's local state self-contained without
 * threading callbacks through props.
 */

const INSERT_EVENT = "cethos-tm:insert-match";

function matchBadgeClass(score: number): string {
  if (score >= 1) return "bg-[color:var(--color-emerald-500)] text-white";
  if (score >= 0.95) return "bg-[color:var(--color-lime-500)] text-white";
  if (score >= 0.75) return "bg-[color:var(--color-amber-500)] text-white";
  return "bg-[color:var(--color-slate-300)] text-[color:var(--color-slate-700)]";
}

export function BottomMatchPanel({
  jobId,
  activeSegmentId,
  activeSegmentSource,
  readOnly,
}: {
  jobId: string;
  activeSegmentId: string | null;
  activeSegmentSource: string | null;
  readOnly: boolean;
}) {
  const [matches, setMatches] = useState<TmMatch[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSegmentId || !activeSegmentSource) {
      setMatches(null);
      return;
    }
    let cancelled = false;
    setError(null);
    startTransition(async () => {
      const res = await findMatchesAction({
        job_id: jobId,
        source_text: activeSegmentSource,
      });
      if (cancelled) return;
      if (res.ok) setMatches(res.matches);
      else setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [jobId, activeSegmentId, activeSegmentSource]);

  function dispatchInsert(match: TmMatch, andConfirm: boolean) {
    if (!activeSegmentId) return;
    window.dispatchEvent(
      new CustomEvent(INSERT_EVENT, {
        detail: { segmentId: activeSegmentId, match, andConfirm },
      }),
    );
  }

  return (
    <div className="border-t border-[color:var(--color-border)] bg-white flex flex-col h-64 overflow-hidden">
      <div className="px-4 py-2 border-b border-[color:var(--color-border-soft)] flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)]">
          TM matches
          {activeSegmentId && (
            <span className="ml-2 text-[color:var(--color-slate-400)] normal-case font-normal">
              · for current segment
            </span>
          )}
        </div>
        <div className="text-[10px] text-[color:var(--color-slate-400)]">
          {isPending && "loading…"}
          {!isPending && matches && `${matches.length} match${matches.length === 1 ? "" : "es"}`}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!activeSegmentId && (
          <div className="text-xs text-[color:var(--color-slate-500)] italic">
            Click a segment to see TM matches here.
          </div>
        )}
        {activeSegmentId && error && (
          <div className="text-xs text-[color:var(--color-rose-600)]">{error}</div>
        )}
        {activeSegmentId && !error && matches && matches.length === 0 && (
          <div className="text-xs text-[color:var(--color-slate-500)] italic">
            No matches yet — confirm a few segments and they'll start appearing here.
          </div>
        )}
        {activeSegmentId && matches && matches.length > 0 && (
          <ul className="space-y-2">
            {matches.map((m) => (
              <li
                key={m.unit_id}
                className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-slate-50)] p-3"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${matchBadgeClass(m.score)}`}
                  >
                    {Math.round(m.score * 100)}%
                  </span>
                  {m.tm_name && (
                    <span className="text-[10px] text-[color:var(--color-slate-500)]">
                      {m.tm_name}
                    </span>
                  )}
                  <span className="text-[10px] text-[color:var(--color-slate-500)] capitalize">
                    · {m.kind}
                  </span>
                </div>
                <div className="text-xs mono text-[color:var(--color-slate-700)] mb-0.5">
                  {m.source_text}
                </div>
                <div className="text-xs mono text-[color:var(--color-navy)]">
                  {m.target_text}
                </div>
                {!readOnly && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => dispatchInsert(m, false)}
                      className="px-2 py-1 text-[11px] font-semibold rounded bg-white border border-[color:var(--color-slate-200)] hover:bg-[color:var(--color-slate-100)]"
                    >
                      Insert
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatchInsert(m, true)}
                      className="px-2 py-1 text-[11px] font-semibold rounded bg-[color:var(--color-emerald-600)] text-white hover:bg-[color:var(--color-emerald-700)]"
                    >
                      Insert &amp; confirm
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export const TM_INSERT_EVENT = INSERT_EVENT;
