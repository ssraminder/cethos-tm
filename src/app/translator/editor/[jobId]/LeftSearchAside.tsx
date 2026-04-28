"use client";

import { useState, useTransition } from "react";
import {
  searchTmAction,
  searchGlossaryAction,
  type TmSearchResult,
  type GlossaryHit,
} from "./search-actions";

/**
 * Left sidebar in the editor: two stacked panels for manual TM concordance
 * search and glossary search. Both are scoped to the current job's
 * source→target language pair (server-side filter) so cross-pair noise
 * doesn't appear in results.
 */
export function LeftSearchAside({ jobId }: { jobId: string }) {
  return (
    <aside className="overflow-y-auto bg-white border-r border-[color:var(--color-border)] p-4 hidden lg:flex lg:flex-col gap-5">
      <TmSearchPanel jobId={jobId} />
      <div className="border-t border-[color:var(--color-border)]" />
      <GlossarySearchPanel jobId={jobId} />
    </aside>
  );
}

function TmSearchPanel({ jobId }: { jobId: string }) {
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
    <section>
      <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-2">
        TM search
      </div>
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
              <div className="text-xs mono text-[color:var(--color-slate-700)]">
                {r.source_text}
              </div>
              <div className="text-xs mono text-[color:var(--color-navy)] mt-0.5">
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
    </section>
  );
}

function GlossarySearchPanel({ jobId }: { jobId: string }) {
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
    <section>
      <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-2">
        Glossary search
      </div>
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
              <div className="flex items-center gap-1.5 text-xs mb-0.5">
                <span className="font-semibold text-[color:var(--color-slate-700)]">
                  {r.source_term}
                </span>
                <span className="text-[color:var(--color-slate-400)]">→</span>
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
    </section>
  );
}
