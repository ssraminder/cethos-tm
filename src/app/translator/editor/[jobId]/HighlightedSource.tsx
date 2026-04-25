import type { TermHit } from "@/lib/termbase/hits";

/**
 * Render source text with non-overlapping term-hit highlights.
 * Forbidden terms get a rose underline; approved get a teal underline.
 */
export function HighlightedSource({ source, hits }: { source: string; hits: TermHit[] }) {
  if (!hits || hits.length === 0) return <>{source}</>;

  // Pick non-overlapping hits, prefer longest first.
  const sorted = [...hits].sort((a, b) => (b.match_len - a.match_len) || (a.match_start - b.match_start));
  const used: TermHit[] = [];
  for (const h of sorted) {
    const overlap = used.some((u) =>
      h.match_start < u.match_start + u.match_len && h.match_start + h.match_len > u.match_start
    );
    if (!overlap) used.push(h);
  }
  used.sort((a, b) => a.match_start - b.match_start);

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const h of used) {
    if (h.match_start > cursor) parts.push(source.slice(cursor, h.match_start));
    const slice = source.slice(h.match_start, h.match_start + h.match_len);
    const cls = h.source_status === "forbidden"
      ? "underline decoration-2 decoration-[color:var(--color-rose-500)] bg-[color:var(--color-rose-50)]"
      : "underline decoration-2 decoration-[color:var(--color-teal)] bg-[color:var(--color-teal-50)]";
    parts.push(
      <span
        key={`${h.concept_id}-${h.match_start}`}
        className={cls}
        title={`${h.source_term} → ${h.target_term} (${h.target_status})`}
      >
        {slice}
      </span>
    );
    cursor = h.match_start + h.match_len;
  }
  if (cursor < source.length) parts.push(source.slice(cursor));
  return <>{parts}</>;
}
