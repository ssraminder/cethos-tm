"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { correctSourceAction, markIllegibleAction, setFieldExcludedAction, saveTranslatorCommentsAction } from "./image-actions";

/**
 * Left pane of the editor for image jobs (scanned PDFs, photos of ID
 * documents). Shows the page image with one outlined region per segment and,
 * below it, what OCR read for the selected field. Picking a region selects
 * its segment row, and focusing a row highlights its region.
 */

export interface ImagePageView {
  page: number;
  width: number;
  height: number;
  url: string;
}

export interface ImageRegionView {
  segmentId: string;
  seq: number;
  page: number;
  /** [x0, y0, x1, y1] in pixels of the page image. */
  box: [number, number, number, number];
  confidence: number;
  /** What OCR originally read. */
  ocrText: string;
  /** Current source text (differs from ocrText once a human corrects it). */
  sourceText: string;
  /** Left out of the translation: background print, holograms and the like. */
  excluded?: boolean;
  findings: Array<{ severity: string; message: string }>;
  /** What the field looks like: a date, a number or identifier, or plain text. */
  kind: "date" | "number" | "text";
}

/** Below this OCR confidence a field is outlined as needing a check. */
const LOW_CONFIDENCE = 0.8;
const ZOOMS = [100, 150, 200] as const;

function needsCheck(r: ImageRegionView): boolean {
  return r.findings.length > 0 || r.confidence < LOW_CONFIDENCE;
}

export function ImagePane({
  pages,
  regions,
  activeSegmentId,
  readOnly,
  jobId,
  initialComments,
  canComment,
  onPick,
}: {
  pages: ImagePageView[];
  regions: ImageRegionView[];
  activeSegmentId: string | null;
  readOnly: boolean;
  jobId: string;
  /** The translator's notes for the project manager, as last saved. */
  initialComments: string;
  canComment: boolean;
  onPick: (segmentId: string) => void;
}) {
  const router = useRouter();
  const [page, setPage] = useState<number>(pages[0]?.page ?? 1);
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(100);
  const [correcting, setCorrecting] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [comments, setComments] = useState(initialComments);
  const [savedComments, setSavedComments] = useState(initialComments);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [savingComments, startSavingComments] = useTransition();

  const saveComments = () => {
    setCommentsError(null);
    startSavingComments(async () => {
      const res = await saveTranslatorCommentsAction({ job_id: jobId, comments });
      if (!res.ok) setCommentsError(res.error);
      else setSavedComments(comments);
    });
  };

  const active = regions.find((r) => r.segmentId === activeSegmentId) ?? null;

  // Follow the selected field to its page, and reset the correction box.
  useEffect(() => {
    if (active) setPage(active.page);
    setCorrecting(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSegmentId]);

  const current = pages.find((p) => p.page === page) ?? pages[0];
  if (!current) {
    return (
      <div className="p-6 text-sm text-[color:var(--color-slate-500)]">
        The page images for this job are not available.
      </div>
    );
  }
  const pageRegions = regions.filter((r) => r.page === current.page);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Something went wrong");
        return;
      }
      setCorrecting(false);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col min-h-0 h-full border-r border-[color:var(--color-border)] bg-[color:var(--color-slate-50)]">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white border-b border-[color:var(--color-border)] shrink-0">
        <div className="text-xs font-bold uppercase tracking-wide text-[color:var(--color-slate-500)]">Source document</div>
        <div className="flex items-center gap-1.5">
          {pages.length > 1 &&
            pages.map((p) => (
              <button
                key={p.page}
                type="button"
                aria-pressed={p.page === current.page}
                onClick={() => setPage(p.page)}
                className={[
                  "px-2.5 py-1 rounded-md text-xs font-semibold border",
                  p.page === current.page
                    ? "bg-[color:var(--color-navy)] text-white border-[color:var(--color-navy)]"
                    : "bg-white text-[color:var(--color-navy)] border-[color:var(--color-slate-200)]",
                ].join(" ")}
              >
                Page {p.page}
              </button>
            ))}
          <label className="ml-2 text-xs text-[color:var(--color-slate-600)] flex items-center gap-1">
            Zoom
            <select
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value) as (typeof ZOOMS)[number])}
              className="text-xs rounded-md border border-[color:var(--color-slate-200)] bg-white px-1 py-1"
            >
              {ZOOMS.map((z) => (
                <option key={z} value={z}>
                  {z}%
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-3">
        <div className="relative" style={{ width: `${zoom}%` }}>
          {/* Signed URL from our own storage; next/image would need a remote-pattern entry and adds nothing here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={`Source document, page ${current.page}`}
            width={current.width}
            height={current.height}
            className="block w-full h-auto rounded-md border border-[color:var(--color-slate-200)] bg-white"
          />
          {pageRegions.map((r) => {
            const isActive = r.segmentId === activeSegmentId;
            const check = needsCheck(r);
            const [x0, y0, x1, y1] = r.box;
            return (
              <button
                key={r.segmentId}
                type="button"
                onClick={() => onPick(r.segmentId)}
                aria-label={`Field ${r.seq}${check ? ", needs a check" : ""}`}
                aria-pressed={isActive}
                title={`Field ${r.seq}`}
                className="absolute rounded-[3px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-teal-600)]"
                style={{
                  left: `${(x0 / current.width) * 100}%`,
                  top: `${(y0 / current.height) * 100}%`,
                  width: `${((x1 - x0) / current.width) * 100}%`,
                  height: `${((y1 - y0) / current.height) * 100}%`,
                  border: isActive ? "2px solid #0e7490" : check ? "2px dashed #b45309" : "1px solid rgba(71,85,105,0.55)",
                  background: isActive ? "rgba(8,145,178,0.14)" : "transparent",
                }}
              >
                {isActive && (
                  <span className="absolute -top-5 left-0 px-1.5 rounded-full bg-[#0e7490] text-white text-[10px] font-bold leading-4">
                    {r.seq}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-1.5 bg-white border-t border-[color:var(--color-border)] text-[11px] text-[color:var(--color-slate-600)] shrink-0">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-3 h-3 rounded-[2px]" style={{ border: "2px solid #0e7490", background: "rgba(8,145,178,0.14)" }} />
          Selected field
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-3 h-3 rounded-[2px]" style={{ border: "2px dashed #b45309" }} />
          Needs a check
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-3 h-3 rounded-[2px]" style={{ border: "1px solid rgba(71,85,105,0.55)" }} />
          Read by OCR
        </span>
      </div>

      <div className="bg-white border-t border-[color:var(--color-border)] p-3 shrink-0 max-h-[40%] overflow-y-auto">
        {!active ? (
          <div className="text-sm text-[color:var(--color-slate-500)]">
            Select a field on the page or a row on the right to see what was read from the image.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-sm font-semibold text-[color:var(--color-navy)]">
                Field {active.seq}
                <span className="ml-2 text-xs font-semibold text-[color:var(--color-teal-700)]">
                  {active.kind === "date" ? "Date" : active.kind === "number" ? "Number or identifier" : "Text"}
                </span>
              </div>
              <div className="text-xs text-[color:var(--color-slate-600)]">
                OCR confidence{" "}
                <span className="font-semibold text-[color:var(--color-navy)] tabular-nums">{Math.round(active.confidence * 100)}%</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--color-teal-700)]">Read from image</div>
              <div className="mono text-sm text-[color:var(--color-navy)] break-words">{active.ocrText}</div>
            </div>
            {active.sourceText !== active.ocrText && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--color-teal-700)]">Corrected to</div>
                <div className="mono text-sm text-[color:var(--color-navy)] break-words">{active.sourceText}</div>
              </div>
            )}
            {active.confidence < LOW_CONFIDENCE && (
              <div className="text-xs rounded-md px-2.5 py-2 bg-[color:var(--color-amber-50)] text-[color:var(--color-navy)]">
                <span className="font-bold">Check:</span> the reading is uncertain. Compare it with the image before confirming.
              </div>
            )}
            {active.findings.map((f, i) => (
              <div key={i} className="text-xs rounded-md px-2.5 py-2 bg-[color:var(--color-amber-50)] text-[color:var(--color-navy)]">
                <span className="font-bold">Check:</span> {f.message}
              </div>
            ))}
            {active.excluded && (
              <div className="text-xs text-[color:var(--color-slate-600)] bg-[color:var(--color-slate-100)] rounded px-2 py-1.5">
                Left out: this field is not part of the document and will not appear in the translation.
              </div>
            )}
            {!readOnly && !correcting && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(active.sourceText);
                    setCorrecting(true);
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded-md border border-[color:var(--color-slate-200)] bg-white text-[color:var(--color-navy)]"
                >
                  Correct the source reading
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => markIllegibleAction({ segment_id: active.segmentId }))}
                  className="px-3 py-2 text-xs font-semibold rounded-md border border-[color:var(--color-slate-200)] bg-white text-[color:var(--color-navy)] disabled:opacity-50"
                >
                  Mark illegible
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => setFieldExcludedAction({ segment_id: active.segmentId, excluded: !active.excluded }))}
                  title="Background security print, hologram text or anything else that is not part of the document's content. The field is left out of the translation."
                  className="px-3 py-2 text-xs font-semibold rounded-md border border-[color:var(--color-slate-200)] bg-white text-[color:var(--color-navy)] disabled:opacity-50"
                >
                  {active.excluded ? "Include in the document again" : "Not part of the document"}
                </button>
              </div>
            )}
            {!readOnly && correcting && (
              <div className="flex flex-col gap-2 pt-1">
                <label className="text-xs font-semibold text-[color:var(--color-navy)] flex flex-col gap-1">
                  Source text as it appears on the document
                  <textarea
                    rows={2}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="mono text-sm rounded-md border border-[color:var(--color-slate-300)] px-2 py-1.5 font-normal"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isPending || draft.trim().length === 0}
                    onClick={() => run(() => correctSourceAction({ segment_id: active.segmentId, source_text: draft }))}
                    className="px-3 py-2 text-xs font-semibold rounded-md bg-[color:var(--color-navy)] text-white disabled:opacity-50"
                  >
                    Save correction
                  </button>
                  <button
                    type="button"
                    onClick={() => setCorrecting(false)}
                    className="px-3 py-2 text-xs font-semibold rounded-md border border-[color:var(--color-slate-200)] bg-white text-[color:var(--color-navy)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {error && <div className="text-xs text-[color:var(--color-rose-700)]">{error}</div>}
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-[color:var(--color-border)] flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[color:var(--color-navy)] flex flex-col gap-1">
            Comments for the project manager
            <textarea
              rows={2}
              value={comments}
              disabled={!canComment}
              onChange={(e) => setComments(e.target.value)}
              placeholder={
                canComment
                  ? "Anything the PM should know before certifying: unclear text, choices you made, questions for the client."
                  : "No comments."
              }
              className="text-sm rounded-md border border-[color:var(--color-slate-300)] px-2 py-1.5 font-normal disabled:bg-[color:var(--color-slate-50)]"
            />
          </label>
          <div className="text-[11px] text-[color:var(--color-slate-600)]">
            Printed on an internal last page of the certified document. The PM removes that page before delivery.
          </div>
          {canComment && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={savingComments || comments === savedComments}
                onClick={saveComments}
                className="px-3 py-2 text-xs font-semibold rounded-md bg-[color:var(--color-navy)] text-white disabled:opacity-50"
              >
                {savingComments ? "Saving..." : "Save comments"}
              </button>
              {comments === savedComments && savedComments !== initialComments && (
                <span className="text-xs text-[color:var(--color-emerald-700)]">Saved</span>
              )}
              {commentsError && <span className="text-xs text-[color:var(--color-rose-700)]">{commentsError}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
