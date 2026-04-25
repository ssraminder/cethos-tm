"use client";

import { useState, useTransition, type ReactNode } from "react";
import { saveSegmentAction, findMatchesAction, getMtAction } from "./actions";
import type { TmMatch } from "@/lib/tm/match";
import type { TermHit } from "@/lib/termbase/hits";
import type { MtSuggestion } from "@/lib/mt";

interface Segment {
  id: string;
  seq: number;
  source_text: string;
  target_text: string;
  status: "untranslated" | "draft" | "translated" | "reviewed" | "locked";
  word_count: number;
}

const statusStyle: Record<Segment["status"], { dot: string; label: string }> = {
  untranslated: { dot: "bg-[color:var(--color-slate-300)]", label: "Open" },
  draft:        { dot: "bg-[color:var(--color-amber-500)]", label: "Draft" },
  translated:   { dot: "bg-[color:var(--color-emerald-500)]", label: "Translated" },
  reviewed:     { dot: "bg-[color:var(--color-emerald-600)]", label: "Reviewed" },
  locked:       { dot: "bg-[color:var(--color-slate-400)]", label: "Locked" },
};

function matchBadgeStyle(score: number): string {
  if (score >= 1)    return "bg-[color:var(--color-emerald-500)] text-white";
  if (score >= 0.95) return "bg-[color:var(--color-lime-500)] text-white";
  if (score >= 0.75) return "bg-[color:var(--color-amber-500)] text-white";
  return "bg-[color:var(--color-slate-300)] text-[color:var(--color-slate-700)]";
}

export function SegmentRow({
  segment,
  readOnly,
  jobId,
  topMatch,
  termHits,
  highlightedSource,
}: {
  segment: Segment;
  readOnly: boolean;
  jobId: string;
  topMatch: TmMatch | null;
  termHits: TermHit[];
  highlightedSource: ReactNode;
}) {
  const [target, setTarget] = useState(segment.target_text);
  const [status, setStatus] = useState(segment.status);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [active, setActive] = useState(false);
  const [matches, setMatches] = useState<TmMatch[] | null>(null);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [mt, setMt] = useState<MtSuggestion | null>(null);
  const [mtLoading, setMtLoading] = useState(false);

  function submit(formData: FormData) {
    startTransition(async () => {
      setError(null);
      const res = await saveSegmentAction(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
      const wantConfirm = formData.get("confirm");
      const trimmed = String(formData.get("target_text") ?? "").trim();
      setStatus(wantConfirm ? "translated" : trimmed ? "draft" : "untranslated");
    });
  }

  async function loadMatches() {
    setMatchesLoading(true);
    const res = await findMatchesAction({ job_id: jobId, source_text: segment.source_text });
    setMatchesLoading(false);
    if (res.ok) setMatches(res.matches);
    else setError(res.error);
  }

  async function loadMt() {
    setMtLoading(true);
    const res = await getMtAction({ segment_id: segment.id });
    setMtLoading(false);
    if (res.ok) setMt(res.suggestion);
    else setError(res.error);
  }

  function insertMt(andConfirm = false) {
    if (!mt) return;
    setTarget(mt.target_text);
    if (readOnly) return;
    const fd = new FormData();
    fd.append("segment_id", segment.id);
    fd.append("target_text", mt.target_text);
    if (andConfirm) fd.append("confirm", "1");
    submit(fd);
  }

  function insertMatch(m: TmMatch, andConfirm = false) {
    setTarget(m.target_text);
    if (readOnly) return;
    const fd = new FormData();
    fd.append("segment_id", segment.id);
    fd.append("target_text", m.target_text);
    if (andConfirm) fd.append("confirm", "1");
    submit(fd);
  }

  const meta = statusStyle[status];

  return (
    <div
      className={[
        "grid grid-cols-[40px_36px_1fr_1fr] gap-3 px-3 py-3 border-b border-[color:var(--color-border-soft)] transition",
        active ? "bg-[color:var(--color-bg-blue)]/40" : "bg-white hover:bg-[color:var(--color-slate-50)]",
        status === "translated" || status === "reviewed" ? "border-l-[3px] border-l-[color:var(--color-emerald-500)]" : "",
      ].join(" ")}
      onFocusCapture={() => setActive(true)}
      onBlurCapture={() => setActive(false)}
    >
      <div className="text-xs text-[color:var(--color-slate-400)] mono pt-1">{segment.seq}</div>
      <div className="flex flex-col items-center pt-1.5 gap-1" title={meta.label}>
        <div className={`w-2 h-2 rounded-full ${meta.dot}`} />
        <div className="text-[9px] uppercase font-bold text-[color:var(--color-slate-400)] tracking-wide">{meta.label[0]}</div>
      </div>

      <div className="text-sm leading-relaxed mono whitespace-pre-wrap text-[color:var(--color-navy)]">
        {highlightedSource}
        {termHits.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap gap-1 font-sans">
            {termHits.slice(0, 5).map((h, i) => (
              <li
                key={`${h.concept_id}-${i}`}
                className={[
                  "text-[10px] px-1.5 py-0.5 rounded border",
                  h.target_status === "forbidden"
                    ? "border-[color:var(--color-rose-200)] bg-[color:var(--color-rose-50)] text-[color:var(--color-rose-600)]"
                    : "border-[color:var(--color-teal-100)] bg-[color:var(--color-teal-50)] text-[color:var(--color-teal-700)]",
                ].join(" ")}
                title={`${h.source_term} → ${h.target_term}`}
              >
                <span className="font-bold">{h.source_term}</span>
                {" → "}
                <span className={h.target_status === "forbidden" ? "line-through" : "font-semibold"}>{h.target_term}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2 text-[10px] mt-1 font-sans">
          <span className="text-[color:var(--color-slate-400)]">{segment.word_count} {segment.word_count === 1 ? "word" : "words"}</span>
          {topMatch && (
            <span className={`px-1.5 py-0.5 rounded font-bold ${matchBadgeStyle(topMatch.score)}`} title={`From ${topMatch.tm_name ?? "TM"} · ${topMatch.kind}`}>
              TM {Math.round(topMatch.score * 100)}%
            </span>
          )}
          {!readOnly && (
            <>
              <button type="button" onClick={loadMatches} className="text-[color:var(--color-teal-700)] hover:underline">
                {matchesLoading ? "Searching…" : matches ? "Refresh matches" : "Find TM matches"}
              </button>
              <button type="button" onClick={loadMt} className="text-[color:var(--color-purple-600)] hover:underline">
                {mtLoading ? "MT…" : mt ? "Re-run MT" : "Get MT"}
              </button>
            </>
          )}
        </div>

        {/* Fuzzy match list (loaded on demand) */}
        {matches && matches.length > 0 && (
          <ul className="mt-2 space-y-1.5 font-sans">
            {matches.map((m) => (
              <li key={m.unit_id} className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-slate-50)] p-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${matchBadgeStyle(m.score)}`}>
                    {Math.round(m.score * 100)}%
                  </span>
                  {m.tm_name && <span className="text-[10px] text-[color:var(--color-slate-500)]">{m.tm_name}</span>}
                  <span className="text-[10px] text-[color:var(--color-slate-500)] capitalize">· {m.kind}</span>
                </div>
                <div className="text-xs mono text-[color:var(--color-slate-700)]">{m.source_text}</div>
                <div className="text-xs mono text-[color:var(--color-navy)] mt-0.5">{m.target_text}</div>
                {!readOnly && (
                  <div className="mt-1.5 flex gap-2">
                    <button type="button" onClick={() => insertMatch(m, false)} className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-white border border-[color:var(--color-slate-200)] hover:bg-[color:var(--color-slate-100)]">
                      Insert
                    </button>
                    <button type="button" onClick={() => insertMatch(m, true)} className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[color:var(--color-emerald-600)] text-white hover:bg-[color:var(--color-emerald-700)]">
                      Insert &amp; confirm
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {matches && matches.length === 0 && (
          <div className="mt-2 text-[10px] text-[color:var(--color-slate-500)] font-sans italic">No matches found in attached TMs.</div>
        )}

        {mt && (
          <div className="mt-2 rounded border border-[color:var(--color-purple-100)] bg-[color:var(--color-purple-100)]/40 p-2 font-sans">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[color:var(--color-purple-500)] text-white uppercase">{mt.engine}</span>
              <span className="text-[10px] text-[color:var(--color-slate-500)]">Machine translation</span>
            </div>
            <div className="text-xs mono text-[color:var(--color-navy)]">{mt.target_text}</div>
            {mt.warning && <div className="text-[10px] text-[color:var(--color-amber-600)] mt-1 italic">{mt.warning}</div>}
            {!readOnly && (
              <div className="mt-1.5 flex gap-2">
                <button type="button" onClick={() => insertMt(false)} className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-white border border-[color:var(--color-slate-200)]">Insert</button>
                <button type="button" onClick={() => insertMt(true)} className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[color:var(--color-emerald-600)] text-white">Insert &amp; confirm</button>
              </div>
            )}
          </div>
        )}
      </div>

      <form action={submit} className="flex flex-col gap-2">
        <input type="hidden" name="segment_id" value={segment.id} />
        <textarea
          name="target_text"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          disabled={readOnly || isPending}
          placeholder={readOnly ? "(read-only)" : "Type translation…"}
          rows={Math.max(2, Math.min(8, Math.ceil(segment.source_text.length / 60)))}
          className={[
            "w-full text-sm leading-relaxed mono rounded-md px-2 py-1.5 border resize-y",
            "border-[color:var(--color-slate-200)] focus:outline-none focus:border-[color:var(--color-teal)] focus:ring-[3px] focus:ring-[color:var(--color-teal)]/20",
            readOnly ? "bg-[color:var(--color-slate-50)] text-[color:var(--color-slate-500)]" : "bg-white",
          ].join(" ")}
        />
        {!readOnly && (
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] text-[color:var(--color-slate-400)]">
              {error && <span className="text-[color:var(--color-rose-600)]">{error}</span>}
              {!error && savedAt && <span>Saved {savedAt}</span>}
              {!error && !savedAt && isPending && <span>Saving…</span>}
            </div>
            <div className="flex items-center gap-2">
              {topMatch && (
                <button
                  type="button"
                  onClick={() => insertMatch(topMatch, topMatch.score >= 1)}
                  className="px-2 py-1 text-xs font-semibold rounded bg-[color:var(--color-bg-blue)] text-[color:var(--color-teal-700)] hover:bg-[color:var(--color-teal-100)]"
                  title={topMatch.score >= 1 ? "Insert exact match and confirm" : "Insert top match"}
                >
                  Use TM {Math.round(topMatch.score * 100)}%
                </button>
              )}
              <button
                type="submit"
                disabled={isPending}
                className="px-2 py-1 text-xs font-semibold rounded border border-[color:var(--color-slate-200)] bg-white hover:bg-[color:var(--color-slate-50)]"
              >
                Save
              </button>
              <button
                type="submit"
                name="confirm"
                value="1"
                disabled={isPending || !target.trim()}
                className="px-2 py-1 text-xs font-semibold rounded bg-[color:var(--color-emerald-600)] text-white hover:bg-[color:var(--color-emerald-700)] disabled:opacity-40"
              >
                Confirm ✓
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
