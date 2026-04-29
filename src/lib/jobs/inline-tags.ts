/**
 * Inline-tag preservation for DOCX and HTML imports.
 *
 * On ingest we keep formatting markers (bold, italic, underline, hyperlink,
 * line break) by converting them to numeric placeholders {N} in the segment
 * text and storing the original tag in segments.meta.tags. The translator
 * sees them as visual chips in the editor and can copy them into the target
 * with one click. The deterministic QA rule `tag_mismatch` enforces 1:1
 * preservation.
 *
 * Why placeholders rather than the raw HTML: a segment like "click {1}here{2}
 * to continue" is easy to translate without HTML knowledge. The translator
 * just keeps the {1} {2} pair somewhere coherent in the target.
 */

export interface InlineTag {
  id: number; // 1-based, matches placeholder {N}
  original_xml: string; // the substring as it appeared (e.g. <b>, </b>, <a href="...">)
  kind: "open" | "close" | "empty";
}

export interface ParagraphSegment {
  plain_text: string;
  tags: InlineTag[];
}

/**
 * Tags we preserve. Block tags (p, div, h*, li, td) are NOT in this set —
 * they bound paragraphs (segment boundaries), not inline runs.
 */
const INLINE_TAG_NAMES = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "sub",
  "sup",
  "a",
  "br",
  "span",
  "code",
]);

const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?\/?>/g;

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function classifyTag(match: string): "open" | "close" | "empty" {
  if (match.endsWith("/>")) return "empty";
  if (match.startsWith("</")) return "close";
  // <br> with no slash is also empty in practice
  const name = match.replace(/^<\/?([a-zA-Z0-9]+).*/, "$1").toLowerCase();
  if (name === "br") return "empty";
  return "open";
}

/**
 * Convert one HTML fragment (a paragraph's inner HTML) into plain text with
 * {N} placeholders + tag inventory. Block tags inside the fragment are
 * stripped (they shouldn't normally appear at paragraph level). Inline tags
 * not in the allowlist are dropped quietly.
 */
export function extractInlineTags(innerHtml: string): ParagraphSegment {
  const tags: InlineTag[] = [];
  let id = 0;
  const withPlaceholders = innerHtml.replace(TAG_RE, (match, rawName: string) => {
    const name = rawName.toLowerCase();
    if (!INLINE_TAG_NAMES.has(name)) {
      // Block-level or unknown tag — drop it from the segment text.
      return "";
    }
    id += 1;
    tags.push({ id, original_xml: match, kind: classifyTag(match) });
    return `{${id}}`;
  });
  // Collapse multiple whitespace, keep newlines as spaces; trim.
  const plain = decodeEntities(withPlaceholders).replace(/\s+/g, " ").trim();
  return { plain_text: plain, tags };
}

/**
 * Split an HTML document into paragraph-level fragments. We split on the
 * closing tag of common block elements; each piece's inner HTML becomes
 * a candidate segment. Empty fragments are dropped.
 *
 * Mammoth's DOCX→HTML output produces clean p / h1-h6 / li / td structure,
 * so this does the right thing for our two supported source formats.
 */
export function splitHtmlIntoParagraphs(html: string): string[] {
  // Insert a sentinel before each block opening so we can split cleanly.
  const SENTINEL = "";
  const blockOpen = /<(p|h[1-6]|li|td|th|tr|blockquote|pre)\b[^>]*?>/gi;
  const tagged = html.replace(blockOpen, (m) => `${SENTINEL}${m}`);
  const pieces = tagged.split(SENTINEL).map((p) => p.trim()).filter(Boolean);
  // For each piece, extract just the inner content of the first block tag.
  const out: string[] = [];
  for (const piece of pieces) {
    const m = piece.match(/^<(p|h[1-6]|li|td|th|tr|blockquote|pre)\b[^>]*?>([\s\S]*?)<\/\1\s*>/i);
    if (m) {
      out.push(m[2]);
    } else {
      // Fallback: strip any leading single tag and use the rest
      out.push(piece.replace(/^<[^>]+>/, "").replace(/<\/[^>]+>$/, ""));
    }
  }
  return out.filter((s) => s.replace(/<[^>]+>/g, "").trim().length > 0);
}

/**
 * Round-trip helper: replace {N} placeholders in a translated string with the
 * matching original tag. Used by DOCX exporters.
 *
 * If a placeholder is missing, leaves the spot empty. If the translator added
 * a placeholder that doesn't exist in the inventory, leaves it as literal
 * text so the QA `tag_mismatch` finding stays visible.
 */
export function injectInlineTags(translated: string, tags: InlineTag[]): string {
  const byId = new Map(tags.map((t) => [t.id, t.original_xml]));
  return translated.replace(/\{(\d+)\}/g, (raw, n) => {
    const id = Number(n);
    return byId.has(id) ? byId.get(id)! : raw;
  });
}
