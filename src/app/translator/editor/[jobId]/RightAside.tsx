"use client";

import { useEffect, useState, useTransition } from "react";
import { findMatchesAction } from "./actions";
import {
  searchTmAction,
  searchGlossaryAction,
  type TmSearchResult,
  type GlossaryHit,
} from "./search-actions";
import type { TmMatch } from "@/lib/tm/match";
import type { TermHit } from "@/lib/termbase/hits";

/**
 * XTM-style right aside. Tabbed panel that follows the active segment.
 *
 * Tabs:
 *   - Matches: TM matches for the active segment (auto-fetched)
 *   - Termbase: term hits for the active segment (passed in from page load)
 *   - TM search: manual concordance search across attached TMs (language pair scoped)
 *   - Glossary: manual term search across attached termbases (language pair scoped)
 *
 * Insert clicks dispatch a window CustomEvent which SegmentRow listens for.
 */

const INSERT_EVENT = "cethos-tm:insert-match";
export const TM_INSERT_EVENT = INSERT_EVENT;

type Tab = "matches" | "term" | "tm-search" | "glossary";

function matchBadgeClass(score: number): string {
  if (score >= 1) return "bg-[color:var(--color-emerald-500)] text-white";
  if (score >= 0.95) return "bg-[color:var(--color-lime-500)] text-white";
  if (score >= 0.75) return "bg-[color:var(--color-amber-500)] text-white";
  return "bg-[color:var(--color-slate-300)] text-[color:var(--color-slate-700)]";
}

export function RightAside({
  jobId,
  readOnly,
  activeSegmentId,
  activeSegmentSource,
  activeSegmentTermHits,
  sourceLangLabel,
  targetLangLabel,
}: {
  jobId: string;
  readOnly: boolean;
  activeSegmentId: string | null;
  activeSegmentSource: string | null;
  activeSegmentTermHits: TermHit[];
  sourceLangLabel: string;
  targetLangLabel: string;
}) {
  const [tab, setTab] = useState<Tab>("matches");

  return (
    <aside className="bg-white border-l border-[color:var(--color-border)] flex flex-col min-h-0 h-full">
      <div className="flex border-b border-[color:var(--color-border)] text-xs">
        <TabButton active={tab === "matches"} onClick={() => setTab("matches")}>
          Matches
        </TabButton>
        <TabButton active={tab === "term"} onClick={() => setTab("term")}>
          Termbase
        </TabButton>
        <TabButton active={tab === "tm-search"} onClick={() => setTab("tm-search")}>
          TM search
        </TabButton>
        <TabButton active={tab === "glossary"} onClick={() => setTab("glossary")}>
          Glossary
        </TabButton>
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {tab === "matches" && (
          <MatchesTab
            jobId={jobId}
            readOnly={readOnly}
            activeSegmentId={activeSegmentId}
            activeSegmentSource={activeSegmentSource}
            sourceLangLabel={sourceLangLabel}
            targetLangLabel={targetLangLabel}
          />
        )}
        {tab === "term" && (
          <TermbaseTab
            activeSegmentId={activeSegmentId}
            termHits={activeSegmentTermHits}
            sourceLangLabel={sourceLangLabel}
            targetLangLabel={targetLangLabel}
          />
        )}
        {tab === "tm-search" && (
          <TmSearchTab
            jobId={jobId}
            sourceLangLabel={sourceLangLabel}
            targetLangLabel={targetLangLabel}
          />
        )}
        {tab === "glossary" && (
          <GlossarySearchTab
            jobId={jobId}
            sourceLangLabel={sourceLangLabel}
            targetLangLabel={targetLangLabel}
          />
        )}
      </div>
    </aside>
  );
}

function FieldLabel({ kind, lang }: { kind: "source" | "target"; lang: string }) {
  return (
    <div
      className={[
        "text-[10px] uppercase tracking-wider font-bold mb-0.5",
        kind === "source"
          ? "text-[color:var(--color-slate-500)]"
          : "text-[color:var(--color-teal-700)]",
      ].join(" ")}
    >
      {kind === "source" ? "Source" : "Target"} &mdash; {lang}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 px-3 py-2 font-semibold transition border-b-2",
        active
          ? "border-[color:var(--color-teal)] text-[color:var(--color-navy)]"
          : "border-transparent text-[color:var(--color-slate-500)] hover:text-[color:var(--color-slate-700)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ---- Matches tab ----------------------------------------------------------

function MatchesTab({
  jobId,
  readOnly,
  activeSegmentId,
  activeSegmentSource,
  sourceLangLabel,
  targetLangLabel,
}: {
  jobId: string;
  readOnly: boolean;
  activeSegmentId: string | null;
  activeSegmentSource: string | null;
  sourceLangLabel: string;
  targetLangLabel: string;
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

  if (!activeSegmentId) {
    return (
      <div className="text-xs text-[color:var(--color-slate-500)] italic">
        Click a segment to see TM matches here.
      </div>
    );
  }
  if (isPending && !matches) {
    return (
      <div className="text-xs text-[color:var(--color-slate-500)]">
        Loading matches…
      </div>
    );
  }
  if (error) {
    return <div className="text-xs text-[color:var(--color-rose-600)]">{error}</div>;
  }
  if (!matches || matches.length === 0) {
    return (
      <div className="text-xs text-[color:var(--color-slate-500)] italic">
        No matches yet — confirm a few segments and they&apos;ll start appearing here.
      </div>
    );
  }

  return (
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
          <FieldLabel kind="source" lang={sourceLangLabel} />
          <div className="text-xs mono text-[color:var(--color-slate-700)] mb-1.5">
            {m.source_text}
          </div>
          <FieldLabel kind="target" lang={targetLangLabel} />
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
  );
}

// ---- Termbase tab ---------------------------------------------------------

function TermbaseTab({
  activeSegmentId,
  termHits,
  sourceLangLabel,
  targetLangLabel,
}: {
  activeSegmentId: string | null;
  termHits: TermHit[];
  sourceLangLabel: string;
  targetLangLabel: string;
}) {
  if (!activeSegmentId) {
    return (
      <div className="text-xs text-[color:var(--color-slate-500)] italic">
        Click a segment to see term hits here.
      </div>
    );
  }
  if (termHits.length === 0) {
    return (
      <div className="text-xs text-[color:var(--color-slate-500)] italic">
        No term hits in this segment.
      </div>
    );
  }
  return (
    <ul className="space-y-1.5">
      {termHits.map((h, i) => (
        <li
          key={`${h.concept_id}-${i}`}
          className={[
            "rounded border p-2 text-xs",
            h.target_status === "forbidden"
              ? "border-[color:var(--color-rose-200)] bg-[color:var(--color-rose-50)]"
              : "border-[color:var(--color-teal-100)] bg-[color:var(--color-teal-50)]",
          ].join(" ")}
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[9px] uppercase font-bold text-[color:var(--color-slate-500)] mono"
              title={`Source — ${sourceLangLabel}`}
            >
              {sourceLangLabel}
            </span>
            <span className="font-semibold text-[color:var(--color-slate-700)]">
              {h.source_term}
            </span>
            <span className="text-[color:var(--color-slate-400)]">→</span>
            <span
              className="text-[9px] uppercase font-bold text-[color:var(--color-teal-700)] mono"
              title={`Target — ${targetLangLabel}`}
            >
              {targetLangLabel}
            </span>
            <span
              className={
                h.target_status === "forbidden"
                  ? "line-through text-[color:var(--color-rose-600)] font-semibold"
                  : "font-semibold text-[color:var(--color-navy)]"
              }
            >
              {h.target_term}
            </span>
          </div>
          {h.target_status === "forbidden" && (
            <div className="text-[10px] text-[color:var(--color-rose-600)] mt-0.5 italic">
              Forbidden — do not use this rendering.
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

// ---- TM search tab --------------------------------------------------------

function TmSearchTab({
  jobId,
  sourceLangLabel,
  targetLangLabel,
}: {
  jobId: string;
  sourceLangLabel: string;
  targetLangLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmSearchResult[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go() {
    const q = query.trim();
    if (q.length < 2) {
      setError("Type at least 2 characters.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await searchTmAction({ job_id: jobId, query: q });
      if (res.ok) setResults(res.results);
      else setError(res.error);
    });
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
        className="flex gap-2 mb-3"
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find phrase in TM…"
          className="flex-1 rounded-md border border-[color:var(--color-slate-200)] bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:border-[color:var(--color-teal)] focus:ring-[2px] focus:ring-[color:var(--color-teal)]/20"
        />
        <button
          type="submit"
          disabled={isPending}
          className="px-2.5 py-1.5 text-xs font-semibold rounded bg-[color:var(--color-navy)] text-white disabled:opacity-50"
        >
          {isPending ? "…" : "Search"}
        </button>
      </form>
      {error && (
        <div className="text-[11px] text-[color:var(--color-rose-600)] mb-2">{error}</div>
      )}
      {results && results.length === 0 && (
        <div className="text-[11px] text-[color:var(--color-slate-500)] italic">
          No matches in attached TMs for this language pair.
        </div>
      )}
      {results && results.length > 0 && (
        <ul className="space-y-2">
          {results.map((r) => (
            <li
              key={r.unit_id}
              className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-slate-50)] p-2"
            >
              <FieldLabel kind="source" lang={sourceLangLabel} />
              <div className="text-xs mono text-[color:var(--color-slate-700)] mb-1.5">
                {r.source_text}
              </div>
              <FieldLabel kind="target" lang={targetLangLabel} />
              <div className="text-xs mono text-[color:var(--color-navy)]">
                {r.target_text}
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[10px] text-[color:var(--color-slate-500)]">
                <span className="truncate">{r.tm_name}</span>
                <span title={r.created_at}>
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- Glossary search tab --------------------------------------------------

function GlossarySearchTab({
  jobId,
  sourceLangLabel,
  targetLangLabel,
}: {
  jobId: string;
  sourceLangLabel: string;
  targetLangLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlossaryHit[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go() {
    const q = query.trim();
    if (q.length < 1) {
      setError("Type a term.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await searchGlossaryAction({ job_id: jobId, query: q });
      if (res.ok) setResults(res.results);
      else setError(res.error);
    });
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
        className="flex gap-2 mb-3"
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find term…"
          className="flex-1 rounded-md border border-[color:var(--color-slate-200)] bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:border-[color:var(--color-teal)] focus:ring-[2px] focus:ring-[color:var(--color-teal)]/20"
        />
        <button
          type="submit"
          disabled={isPending}
          className="px-2.5 py-1.5 text-xs font-semibold rounded bg-[color:var(--color-navy)] text-white disabled:opacity-50"
        >
          {isPending ? "…" : "Search"}
        </button>
      </form>
      {error && (
        <div className="text-[11px] text-[color:var(--color-rose-600)] mb-2">{error}</div>
      )}
      {results && results.length === 0 && (
        <div className="text-[11px] text-[color:var(--color-slate-500)] italic">
          No matches in attached glossaries for this language pair.
        </div>
      )}
      {results && results.length > 0 && (
        <ul className="space-y-2">
          {results.map((r) => (
            <li
              key={r.concept_id}
              className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-slate-50)] p-2"
            >
              <div className="flex items-center gap-1.5 text-xs mb-0.5 flex-wrap">
                <span
                  className="text-[9px] uppercase font-bold text-[color:var(--color-slate-500)] mono"
                  title={`Source — ${sourceLangLabel}`}
                >
                  {sourceLangLabel}
                </span>
                <span className="font-semibold text-[color:var(--color-slate-700)]">
                  {r.source_term}
                </span>
                <span className="text-[color:var(--color-slate-400)]">→</span>
                <span
                  className="text-[9px] uppercase font-bold text-[color:var(--color-teal-700)] mono"
                  title={`Target — ${targetLangLabel}`}
                >
                  {targetLangLabel}
                </span>
                <span
                  className={
                    r.target_status === "forbidden"
                      ? "line-through text-[color:var(--color-rose-600)]"
                      : "font-semibold text-[color:var(--color-navy)]"
                  }
                >
                  {r.target_term}
                </span>
              </div>
              {r.definition && (
                <div className="text-[11px] text-[color:var(--color-slate-600)] mt-0.5">
                  {r.definition}
                </div>
              )}
              <div className="flex items-center justify-between mt-1 text-[10px] text-[color:var(--color-slate-500)]">
                <span className="truncate">{r.termbase_name}</span>
                {r.domain && <span>· {r.domain}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
