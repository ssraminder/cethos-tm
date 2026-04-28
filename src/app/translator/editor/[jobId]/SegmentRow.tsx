"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
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
  target_origin?:
    | "human"
    | "mt"
    | "mt_edited"
    | "tm"
    | "tm_edited"
    | "copied_source"
    | null;
}

type Origin = NonNullable<Segment["target_origin"]>;

const originBadge: Partial<
  Record<Origin, { label: string; className: string; title: string }>
> = {
  mt: {
    label: "MT",
    className: "bg-[color:var(--color-purple-500)] text-white",
    title: "Machine-translated, unedited",
  },
  mt_edited: {
    label: "MT edited",
    className: "bg-[color:var(--color-purple-100)] text-[color:var(--color-purple-700)] border border-[color:var(--color-purple-200)]",
    title: "Started from MT, then edited by translator",
  },
  tm: {
    label: "TM",
    className: "bg-[color:var(--color-emerald-500)] text-white",
    title: "Inserted from TM, unedited",
  },
  tm_edited: {
    label: "TM edited",
    className: "bg-[color:var(--color-emerald-100)] text-[color:var(--color-emerald-700)] border border-[color:var(--color-emerald-200)]",
    title: "Started from TM, then edited by translator",
  },
  copied_source: {
    label: "copied source",
    className: "bg-[color:var(--color-slate-200)] text-[color:var(--color-slate-700)]",
    title: "Source copied verbatim into target",
  },
};

const statusStyle: Record<Segment["status"], { dot: string; label: string }> = {
  untranslated: { dot: "bg-[color:var(--color-slate-300)]", label: "Open" },
  draft:        { dot: "bg-[color:var(--color-amber-500)]", label: "Draft" },
  translated:   { dot: "bg-[color:var(--color-emerald-500)]", label: "Translated" },
  reviewed:     { dot: "bg-[color:var(--color-emerald-600)]", label: "Reviewed" },
  locked:       { dot: "bg-[color:var(--color-slate-400)]", label: "Locked" },
};

/**
 * Big, glanceable per-segment status icon. The translated / reviewed
 * states show a check (single / double) inside a filled emerald circle —
 * doubles as a "this has been saved into the TM" indicator since every
 * confirm writes to the default TM. Tooltip spells it out for new
 * translators.
 */
function StatusIcon({
  status,
  pulse,
}: {
  status: Segment["status"];
  pulse: boolean;
}) {
  const tooltip: Record<Segment["status"], string> = {
    untranslated: "Open — not yet translated",
    draft: "Draft — typed but not confirmed",
    translated: "Confirmed · saved to translation memory",
    reviewed: "Reviewed · saved to translation memory",
    locked: "Locked",
  };
  const wrap = (inner: ReactNode, ring: string) => (
    <div
      className={[
        "w-6 h-6 rounded-full flex items-center justify-center transition",
        ring,
        pulse ? "ring-4 ring-[color:var(--color-emerald-300)]/60" : "",
      ].join(" ")}
      title={tooltip[status]}
      aria-label={tooltip[status]}
    >
      {inner}
    </div>
  );

  if (status === "translated") {
    return wrap(
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>,
      "bg-[color:var(--color-emerald-500)]",
    );
  }
  if (status === "reviewed") {
    return wrap(
      // Double check
      <svg width="16" height="14" viewBox="0 0 24 18" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="2 11 8 17 14 5" />
        <polyline points="9 11 15 17 21 5" />
      </svg>,
      "bg-[color:var(--color-emerald-600)]",
    );
  }
  if (status === "draft") {
    return wrap(
      // Pencil / dot
      <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="0">
        <circle cx="12" cy="12" r="4" />
      </svg>,
      "bg-[color:var(--color-amber-500)]",
    );
  }
  if (status === "locked") {
    return wrap(
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>,
      "bg-[color:var(--color-slate-400)]",
    );
  }
  // untranslated → empty ring
  return wrap(
    null,
    "border-2 border-[color:var(--color-slate-300)] bg-white",
  );
}

function matchBadgeStyle(score: number): string {
  if (score >= 1)    return "bg-[color:var(--color-emerald-500)] text-white";
  if (score >= 0.95) return "bg-[color:var(--color-lime-500)] text-white";
  if (score >= 0.75) return "bg-[color:var(--color-amber-500)] text-white";
  return "bg-[color:var(--color-slate-300)] text-[color:var(--color-slate-700)]";
}

export interface QaFindingDisplay {
  rule: string;
  severity: string;
  message: string;
}

export function SegmentRow({
  segment,
  readOnly,
  jobId,
  topMatch,
  termHits,
  highlightedSource,
  qaFindings,
  showMt,
}: {
  segment: Segment;
  readOnly: boolean;
  jobId: string;
  topMatch: TmMatch | null;
  termHits: TermHit[];
  highlightedSource: ReactNode;
  qaFindings: QaFindingDisplay[];
  /**
   * Whether the MT panel ("Get MT" button + suggestion box) is visible.
   * Hidden by default for translators; PMs/admins still see it. When MT is
   * needed for vendor-facing jobs, we'll prepopulate target_text directly
   * at job-creation time.
   */
  showMt: boolean;
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
  // Provenance of the current target_text. Updates as the translator
  // pastes from MT / TM / Copy source, and flips to *_edited / human
  // when they diverge from the inserted text. Persisted on save.
  const [origin, setOrigin] = useState<Origin | null>(
    segment.target_origin ?? null,
  );
  // The text we last "set" from a machine source (MT/TM/copy). When the
  // textarea content matches this, origin stays as the machine value.
  // When it differs, origin flips to *_edited (or 'human').
  const [pristine, setPristine] = useState<{
    text: string;
    origin: Origin;
  } | null>(null);

  function deriveOriginAfterEdit(value: string): Origin {
    if (pristine && value === pristine.text) return pristine.origin;
    if (origin === "mt" || origin === "mt_edited") return "mt_edited";
    if (origin === "tm" || origin === "tm_edited") return "tm_edited";
    return "human";
  }

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

  // Build a FormData for the form submit including current origin. The
  // <form action> path doesn't go through this — it builds its own
  // FormData from inputs — so the textarea form has a hidden `origin`
  // input synced to state.

  function copySourceToTarget() {
    if (readOnly) return;
    setTarget(segment.source_text);
    setOrigin("copied_source");
    setPristine({ text: segment.source_text, origin: "copied_source" });
  }

  async function loadMatches() {
    setMatchesLoading(true);
    const res = await findMatchesAction({ job_id: jobId, source_text: segment.source_text });
    setMatchesLoading(false);
    if (res.ok) setMatches(res.matches);
    else setError(res.error);
  }

  // Auto-load fuzzy matches once on mount so the translator doesn't have
  // to click "Find TM matches" per row. The page-load topMatch covers the
  // ≥1.0 exact case; this fills in everything below 1.0.
  //
  // Side effect: if a 100% match exists AND target is empty AND we're not
  // read-only, auto-populate the target cell with the exact match. The
  // translator can edit or hit Confirm directly. Fuzzy matches only
  // populate the panel — translator still has to click Insert to use them.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await findMatchesAction({ job_id: jobId, source_text: segment.source_text });
      if (cancelled) return;
      if (res.ok) setMatches(res.matches);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, segment.id]);

  // Auto-insert a 100% TM match into the target if the target is empty.
  // We rely on `topMatch` from page-load (it's the top-scored exact match
  // for this segment). Only triggers when (a) score >= 1.0, (b) the
  // textarea is currently empty, (c) the row isn't read-only.
  useEffect(() => {
    if (readOnly) return;
    if (!topMatch || topMatch.score < 1) return;
    if (target.trim().length > 0) return;
    setTarget(topMatch.target_text);
    setOrigin("tm");
    setPristine({ text: topMatch.target_text, origin: "tm" });
    // Don't auto-confirm — translator reviews and clicks Confirm. Don't
    // persist to DB either — the next Save/Confirm covers that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setOrigin("mt");
    setPristine({ text: mt.target_text, origin: "mt" });
    if (readOnly) return;
    const fd = new FormData();
    fd.append("segment_id", segment.id);
    fd.append("target_text", mt.target_text);
    fd.append("origin", "mt");
    if (andConfirm) fd.append("confirm", "1");
    submit(fd);
  }

  function insertMatch(m: TmMatch, andConfirm = false) {
    setTarget(m.target_text);
    setOrigin("tm");
    setPristine({ text: m.target_text, origin: "tm" });
    if (readOnly) return;
    const fd = new FormData();
    fd.append("segment_id", segment.id);
    fd.append("target_text", m.target_text);
    fd.append("origin", "tm");
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
      <div className="flex flex-col items-center pt-0.5 gap-1">
        <StatusIcon status={status} pulse={!!savedAt && status === "translated"} />
        <div className="text-[9px] uppercase font-bold text-[color:var(--color-slate-500)] tracking-wide">{meta.label}</div>
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
                {matchesLoading ? "Searching…" : "Refresh matches"}
              </button>
              {showMt && (
                <button type="button" onClick={loadMt} className="text-[color:var(--color-purple-600)] hover:underline">
                  {mtLoading ? "MT…" : mt ? "Re-run MT" : "Get MT"}
                </button>
              )}
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
          <div className="mt-2 text-[10px] text-[color:var(--color-slate-500)] font-sans italic">No matches yet — confirm a few segments and they'll start appearing here.</div>
        )}

        {showMt && mt && (
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
        {qaFindings.length > 0 && (
          <ul className="space-y-1">
            {qaFindings.slice(0, 3).map((f, i) => (
              <li key={`${f.rule}-${i}`} className={[
                "text-[11px] rounded border px-2 py-1 font-sans",
                f.severity === "critical" ? "border-[color:var(--color-rose-200)] bg-[color:var(--color-rose-50)] text-[color:var(--color-rose-600)]"
                  : f.severity === "major" ? "border-[color:var(--color-amber-100)] bg-[color:var(--color-amber-50)] text-[color:var(--color-amber-600)]"
                  : "border-[color:var(--color-slate-200)] bg-[color:var(--color-slate-50)] text-[color:var(--color-slate-600)]",
              ].join(" ")}>
                <span className="font-bold uppercase tracking-wide mr-1">{f.severity}</span>
                <span className="font-mono mr-1">{f.rule}</span>
                {f.message}
              </li>
            ))}
          </ul>
        )}
        <input type="hidden" name="segment_id" value={segment.id} />
        <input
          type="hidden"
          name="origin"
          value={
            target.trim().length === 0
              ? ""
              : (pristine && target === pristine.text)
              ? pristine.origin
              : (origin === "mt" || origin === "mt_edited")
              ? "mt_edited"
              : (origin === "tm" || origin === "tm_edited")
              ? "tm_edited"
              : "human"
          }
        />
        <textarea
          name="target_text"
          value={target}
          onChange={(e) => {
            const v = e.target.value;
            setTarget(v);
            if (v.trim().length === 0) {
              setOrigin(null);
              setPristine(null);
            } else {
              setOrigin(deriveOriginAfterEdit(v));
            }
          }}
          disabled={readOnly || isPending}
          placeholder={readOnly ? "(read-only)" : "Type translation…"}
          rows={Math.max(2, Math.min(8, Math.ceil(segment.source_text.length / 60)))}
          className={[
            "w-full text-sm leading-relaxed mono rounded-md px-2 py-1.5 border resize-y",
            "border-[color:var(--color-slate-200)] focus:outline-none focus:border-[color:var(--color-teal)] focus:ring-[3px] focus:ring-[color:var(--color-teal)]/20",
            readOnly ? "bg-[color:var(--color-slate-50)] text-[color:var(--color-slate-500)]" : "bg-white",
          ].join(" ")}
        />
        {origin && originBadge[origin] && (
          <div className="flex items-center gap-1.5">
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${originBadge[origin]!.className}`}
              title={originBadge[origin]!.title}
            >
              {originBadge[origin]!.label}
            </span>
            {(origin === "mt" || origin === "copied_source") && status === "translated" && (
              <span className="text-[10px] text-[color:var(--color-amber-600)] italic font-sans">
                confirmed without edits
              </span>
            )}
          </div>
        )}
        {!readOnly && (
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] text-[color:var(--color-slate-400)]">
              {error && <span className="text-[color:var(--color-rose-600)]">{error}</span>}
              {!error && savedAt && status === "translated" && (
                <span className="text-[color:var(--color-emerald-700)] font-semibold">
                  ✓ Confirmed · saved to TM at {savedAt}
                </span>
              )}
              {!error && savedAt && status !== "translated" && <span>Saved {savedAt}</span>}
              {!error && !savedAt && isPending && <span>Saving…</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copySourceToTarget}
                disabled={isPending}
                className="px-2 py-1 text-xs font-semibold rounded border border-[color:var(--color-slate-200)] bg-white text-[color:var(--color-slate-700)] hover:bg-[color:var(--color-slate-50)]"
                title="Copy the source text into the target cell verbatim — useful for brand names, numbers, code"
              >
                Copy source
              </button>
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
