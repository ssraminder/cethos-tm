"use client";

import { useState, type ReactNode } from "react";
import { SegmentRow, type QaFindingDisplay } from "./SegmentRow";
import { RightAside } from "./RightAside";
import { ImagePane, type ImagePageView, type ImageRegionView } from "./ImagePane";
import type { TmMatch } from "@/lib/tm/match";
import type { TermHit } from "@/lib/termbase/hits";

/**
 * Wraps the segments grid + the XTM-style right tabbed pane.
 *
 * Lifts the "currently active segment" state so the right pane can fetch
 * and render matches/term hits/etc. for whichever row the translator is on.
 * Each SegmentRow registers its activation via onActivate (focus or click).
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
  image,
  highlightedSourceById,
  topMatchById,
  termHitsById,
  qaFindingsById,
  sourceLangLabel,
  targetLangLabel,
  sourceLangCode,
  targetLangCode,
  sourceRtl,
  targetRtl,
}: {
  jobId: string;
  readOnly: boolean;
  showMt: boolean;
  segments: SegmentForClient[];
  /** Set for image jobs: page images and one region per segment. */
  image?: { pages: ImagePageView[]; regions: ImageRegionView[]; comments: string; canComment: boolean } | null;
  // Maps from segment_id to the per-segment data the row needs.
  highlightedSourceById: Record<string, ReactNode>;
  topMatchById: Record<string, TmMatch | null>;
  termHitsById: Record<string, TermHit[]>;
  qaFindingsById: Record<string, QaFindingDisplay[]>;
  sourceLangLabel: string;
  targetLangLabel: string;
  sourceLangCode: string;
  targetLangCode: string;
  sourceRtl: boolean;
  targetRtl: boolean;
}) {
  const [active, setActive] = useState<{ id: string; source_text: string } | null>(
    null,
  );

  const activeTermHits: TermHit[] = active ? termHitsById[active.id] ?? [] : [];

  const isImageJob = !!image && image.pages.length > 0;
  const excludedById = new Map<string, boolean>(
    (image?.regions ?? []).map((r) => [r.segmentId, !!r.excluded]),
  );

  // Picking a region on the page selects its row: focus the row's target box
  // (which also fires the row's own onActivate) and bring it into view.
  const pickSegment = (segmentId: string) => {
    const seg = segments.find((s) => s.id === segmentId);
    if (seg) setActive({ id: seg.id, source_text: seg.source_text });
    const row = document.querySelector<HTMLElement>(`[data-seg-id="${segmentId}"]`);
    if (!row) return;
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    row.querySelector<HTMLTextAreaElement>("textarea:not([disabled])")?.focus({ preventScroll: true });
  };

  return (
    <div
      className={[
        "grid grid-cols-1 h-full min-h-0",
        isImageJob ? "lg:grid-cols-[minmax(360px,44%)_1fr]" : "lg:grid-cols-[1fr_360px]",
      ].join(" ")}
    >
      {isImageJob && (
        <ImagePane
          pages={image!.pages}
          regions={image!.regions}
          activeSegmentId={active?.id ?? null}
          readOnly={readOnly}
          jobId={jobId}
          initialComments={image!.comments}
          canComment={image!.canComment}
          onPick={pickSegment}
        />
      )}
      <div className="flex flex-col min-h-0 overflow-hidden border-r border-[color:var(--color-border)]">
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
                  // A corrected source reading or an "illegible" mark changes the row
                  // on the server; the key makes the row pick the new text up.
                  key={`${s.id}:${s.source_text}:${s.target_text === "[illegible]"}:${excludedById.get(s.id) ? "bg" : ""}`}
                  segment={s}
                  readOnly={readOnly}
                  jobId={jobId}
                  topMatch={topMatchById[s.id] ?? null}
                  termHits={termHitsById[s.id] ?? []}
                  highlightedSource={highlightedSourceById[s.id]}
                  qaFindings={qaFindingsById[s.id] ?? []}
                  showMt={showMt}
                  sourceLangCode={sourceLangCode}
                  targetLangCode={targetLangCode}
                  sourceRtl={sourceRtl}
                  targetRtl={targetRtl}
                  selected={isImageJob && active?.id === s.id}
                  onActivate={(seg) => setActive(seg)}
                  imageField={isImageJob && excludedById.has(s.id) ? { excluded: excludedById.get(s.id)! } : null}
                />
              ))}
            </>
          )}
        </div>
      </div>
      {!isImageJob && (
      <RightAside
        jobId={jobId}
        readOnly={readOnly}
        activeSegmentId={active?.id ?? null}
        activeSegmentSource={active?.source_text ?? null}
        activeSegmentTermHits={activeTermHits}
        sourceLangLabel={sourceLangLabel}
        targetLangLabel={targetLangLabel}
        sourceLangCode={sourceLangCode}
        targetLangCode={targetLangCode}
        sourceRtl={sourceRtl}
        targetRtl={targetRtl}
      />
      )}
    </div>
  );
}
