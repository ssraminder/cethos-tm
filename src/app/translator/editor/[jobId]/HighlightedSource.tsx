import type { TermHit } from "@/lib/termbase/hits";

/**
 * Render source text with two layers of inline annotation:
 *   - Term highlights from attached termbases (teal = approved, rose = forbidden)
 *   - {N} placeholders as styled tag chips (so the translator can see and
 *     copy them into the target)
 *
 * The two layers don't overlap by construction — placeholders contain only
 * digits and braces and termbase hits won't match those.
 */
export function HighlightedSource({ source, hits }: { source: string; hits: TermHit[] }) {
  // First, split on {N} placeholders so they get their own chip nodes.
  const parts: Array<{ kind: "text"; value: string } | { kind: "tag"; id: number }> = [];
  let cursor = 0;
  const PLACEHOLDER_RE = /\{(\d+)\}/g;
  for (const m of source.matchAll(PLACEHOLDER_RE)) {
    const start = m.index ?? 0;
    if (start > cursor) parts.push({ kind: "text", value: source.slice(cursor, start) });
    parts.push({ kind: "tag", id: Number(m[1]) });
    cursor = start + m[0].length;
  }
  if (cursor < source.length) parts.push({ kind: "text", value: source.slice(cursor) });

  return (
    <>
      {parts.map((p, idx) =>
        p.kind === "tag" ? (
          <TagChip key={`tag-${idx}-${p.id}`} id={p.id} />
        ) : (
          <TermHighlights key={`txt-${idx}`} text={p.value} hits={hits} offset={offsetOf(parts, idx)} />
        ),
      )}
    </>
  );
}

function offsetOf(
  parts: Array<{ kind: "text"; value: string } | { kind: "tag"; id: number }>,
  idx: number,
): number {
  // Term hits use absolute offsets in the original source string. We need to
  // translate them into the per-text-chunk offset.
  let off = 0;
  for (let i = 0; i < idx; i++) {
    const p = parts[i];
    if (p.kind === "text") off += p.value.length;
    else off += `{${p.id}}`.length;
  }
  return off;
}

function TagChip({ id }: { id: number }) {
  return (
    <span
      className="inline-block px-1.5 py-0 mx-0.5 rounded bg-[color:var(--color-bg-blue)] text-[color:var(--color-teal-700)] text-[10px] font-bold mono align-middle border border-[color:var(--color-teal-200)]"
      title={`Inline formatting tag #${id} — preserve this in the target`}
      data-tag-id={id}
    >
      {`{${id}}`}
    </span>
  );
}

function TermHighlights({
  text,
  hits,
  offset,
}: {
  text: string;
  hits: TermHit[];
  offset: number;
}) {
  if (!hits || hits.length === 0) return <>{text}</>;

  // Translate hits into this slice's coordinate space and drop ones that
  // don't fall inside.
  const localHits = hits
    .map((h) => ({ ...h, _start: h.match_start - offset }))
    .filter((h) => h._start >= 0 && h._start + h.match_len <= text.length);

  if (localHits.length === 0) return <>{text}</>;

  const sorted = [...localHits].sort((a, b) => (b.match_len - a.match_len) || (a._start - b._start));
  const used: typeof localHits = [];
  for (const h of sorted) {
    const overlap = used.some(
      (u) => h._start < u._start + u.match_len && h._start + h.match_len > u._start,
    );
    if (!overlap) used.push(h);
  }
  used.sort((a, b) => a._start - b._start);

  const out: React.ReactNode[] = [];
  let cur = 0;
  for (const h of used) {
    if (h._start > cur) out.push(text.slice(cur, h._start));
    const slice = text.slice(h._start, h._start + h.match_len);
    const cls =
      h.source_status === "forbidden"
        ? "underline decoration-2 decoration-[color:var(--color-rose-500)] bg-[color:var(--color-rose-50)]"
        : "underline decoration-2 decoration-[color:var(--color-teal)] bg-[color:var(--color-teal-50)]";
    out.push(
      <span
        key={`${h.concept_id}-${h._start}`}
        className={cls}
        title={`${h.source_term} → ${h.target_term} (${h.target_status})`}
      >
        {slice}
      </span>,
    );
    cur = h._start + h.match_len;
  }
  if (cur < text.length) out.push(text.slice(cur));
  return <>{out}</>;
}
