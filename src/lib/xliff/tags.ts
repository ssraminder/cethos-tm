/**
 * Inline-tag handling for XLIFF segments.
 *
 * On ingest: replace each inline tag (e.g. <g id="1">, <x id="1"/>, <ph ...>)
 * with a numeric placeholder {N} in the segment's plain text. Store the
 * original XML in segments.meta.tags so we can rebuild the target on export.
 *
 * On export: scan the translator's target_text for {N} markers and substitute
 * the matching original XML back in (preserving the source's tag order is the
 * translator's responsibility — we just round-trip whatever they typed).
 */

export interface InlineTag {
  id: number;            // 1-based, matches placeholder {N}
  original_xml: string;  // exact substring as it appeared in the source XLIFF
  kind: "open" | "close" | "empty";
}

export interface ExtractedSegment {
  plain_text: string;
  tags: InlineTag[];
}

const TAG_RE = /<\/?\w+(?:\s+[^>]*?)?\/?>/g;

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Extract inline tags from the raw inner XML of a <source> or <target>
 * element. Returns plain text with {N} placeholders and the tag inventory.
 */
export function extractInlineTags(innerXml: string): ExtractedSegment {
  const tags: InlineTag[] = [];
  let id = 0;
  const plain = innerXml.replace(TAG_RE, (match) => {
    id += 1;
    const kind: InlineTag["kind"] = match.endsWith("/>") ? "empty"
      : match.startsWith("</") ? "close" : "open";
    tags.push({ id, original_xml: match, kind });
    return `{${id}}`;
  });
  return { plain_text: decodeEntities(plain), tags };
}

/**
 * Find a single XLIFF 1.2 element's inner XML by tag name within a raw block.
 * Returns null if not found.
 */
export function findInnerXml(block: string, tagName: string): string | null {
  const re = new RegExp(`<${tagName}\\b[^>]*?>([\\s\\S]*?)</${tagName}>`, "i");
  const m = block.match(re);
  return m ? m[1] : null;
}

/**
 * Iterate <trans-unit> blocks in a raw XLIFF 1.2 string. Each block is the
 * full XML span including the opening + closing tags.
 */
export function* iterateTransUnits(raw: string): Generator<{ id: string; block: string; approved: boolean }> {
  const re = /<trans-unit\b([^>]*)>([\s\S]*?)<\/trans-unit>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const attrs = m[1];
    const inner = m[2];
    const idMatch = attrs.match(/\bid\s*=\s*["']([^"']+)["']/i);
    const apMatch = attrs.match(/\bapproved\s*=\s*["']yes["']/i);
    yield { id: idMatch ? idMatch[1] : "", block: inner, approved: !!apMatch };
  }
}

export interface ReinsertResult {
  xml_inner: string;
  unresolved_placeholders: number[];
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Rebuild the inner XML of a <target> by re-inserting original tag XML at the
 * positions of {N} placeholders in the translator's target text. Plain text
 * around placeholders is XML-escaped so it stays valid in the document.
 */
export function reinsertInlineTags(targetText: string, tags: InlineTag[]): ReinsertResult {
  const byId = new Map(tags.map((t) => [t.id, t.original_xml]));
  const unresolved = new Set<number>();

  const out = targetText.replace(/\{(\d+)\}/g, (_match, idStr) => {
    const id = Number(idStr);
    const xml = byId.get(id);
    if (!xml) {
      unresolved.add(id);
      return `{${id}}`;
    }
    return xml;
  });

  // The non-placeholder portions still need XML escaping. Reconstruct piece by piece.
  const parts: string[] = [];
  let i = 0;
  const placeholderRe = /\{(\d+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = placeholderRe.exec(out)) !== null) {
    if (m.index > i) parts.push(escapeXml(out.slice(i, m.index)));
    const id = Number(m[1]);
    const xml = byId.get(id);
    if (xml) parts.push(xml);
    else parts.push(escapeXml(`{${id}}`));
    i = m.index + m[0].length;
  }
  if (i < out.length) parts.push(escapeXml(out.slice(i)));

  return {
    xml_inner: parts.join(""),
    unresolved_placeholders: Array.from(unresolved),
  };
}

/**
 * Compare placeholder sets between source and target. Returns issues for QA.
 */
export function compareTagSets(sourceText: string, targetText: string): {
  missing_in_target: number[];
  extra_in_target: number[];
} {
  const ids = (s: string) => {
    const out = new Set<number>();
    const re = /\{(\d+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) out.add(Number(m[1]));
    return out;
  };
  const src = ids(sourceText);
  const tgt = ids(targetText);
  const missing = [...src].filter((x) => !tgt.has(x));
  const extra = [...tgt].filter((x) => !src.has(x));
  return { missing_in_target: missing.sort((a, b) => a - b), extra_in_target: extra.sort((a, b) => a - b) };
}
