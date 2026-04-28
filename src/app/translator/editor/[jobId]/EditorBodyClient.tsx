"use client";

import { useState, type ReactNode } from "react";
import { SegmentRow, type QaFindingDisplay } from "./SegmentRow";
import { BottomMatchPanel } from "./BottomMatchPanel";
import type { TmMatch } from "@/lib/tm/match";
import type { TermHit } from "@/lib/termbase/hits";

/**
 * Wraps the segments grid + the bottom TM-match split panel.
 *
 * Lifts the "currently active segment" state so the bottom panel can fetch
 * and render matches for whichever row the translator is on. Each
 * SegmentRow registers its activation via onActivate (focus or click).
 */

export interface SegmentForClient {
  id: string;
  seq: number;
  source_text: string;
  target_text: string;
  status: "untranslated" | "draft" | "translated" | "reviewed" | "locked";
  word_count: number;
  target_origin?:
    | "human"
    | "mt"
    | "mt_edited"
    | "tm"
    | "tm_edited"
    | "copied_source"
    | null;
}

export function EditorBodyClient({
  jobId,
  readOnly,
  showMt,
  segments,
  highlightedSourceById,
  topMatchById,
  termHitsById,
  qaFindingsById,
  sourceLangLabel,
  targetLangLabel,
}: {
  jobId: string;
  readOnly: boolean;
  showMt: boolean;
  segments: SegmentForClient[];
  // Maps from segment_id to the per-segment data the row needs.
  highlightedSourceById: Record<string, ReactNode>;
  topMatchById: Record<string, TmMatch | null>;
  termHitsById: Record<string, TermHit[]>;
  qaFindingsById: Record<string, QaFindingDisplay[]>;
  sourceLangLabel: string;
  targetLangLabel: string;
}) {
  const [active, setActive] = useState<{ id: string; source_text: string } | null>(
    null,
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto">
        {segments.length === 0 ? (
          <div className="p-12 text-center text-sm text-[color:var(--color-slate-500)]">
            No segments match this filter.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[40px_36px_1fr_1fr] gap-3 px-3 py-2 bg-[color:var(--color-slate-50)] text-[10px] uppercase font-bold tracking-wide text-[color:var(--color-slate-500)] sticky top-0 z-10 border-b border-[color:var(--color-border)]">
              <div>#</div>
              <div></div>
              <div>{sourceLangLabel}</div>
              <div>{targetLangLabel}</div>
            </div>
            {segments.map((s) => (
              <SegmentRow
                key={s.id}
                segment={s}
                readOnly={readOnly}
                jobId={jobId}
                topMatch={topMatchById[s.id] ?? null}
                termHits={termHitsById[s.id] ?? []}
                highlightedSource={highlightedSourceById[s.id]}
                qaFindings={qaFindingsById[s.id] ?? []}
                showMt={showMt}
                onActivate={(seg) => setActive(seg)}
              />
            ))}
          </>
        )}
      </div>
      <BottomMatchPanel
        jobId={jobId}
        activeSegmentId={active?.id ?? null}
        activeSegmentSource={active?.source_text ?? null}
        readOnly={readOnly}
      />
    </div>
  );
}
