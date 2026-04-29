/**
 * OOXML run-level tag handling for DOCX round-trip.
 *
 * Extraction: walk a <w:p> body and emit segment text where each formatted
 * run (and each hyperlink wrapper, br, tab) is delimited by a {N} placeholder
 * pair (open + close) so the translator sees explicit boundaries. The
 * original run properties (<w:rPr>) and hyperlink targets are stored in the
 * tag inventory.
 *
 * Rebuild: walk a translated string with embedded {N} markers, look each up
 * in the inventory, and produce a sequence of <w:r> / <w:hyperlink> /
 * <w:br/> / <w:tab/> elements that re-create the formatting.
 *
 * Limitations:
 * - Fields, drawings, footnote/endnote refs, math, comments are dropped
 *   from the segment text and won't survive the round-trip.
 * - Bookmarks (<w:bookmarkStart>, <w:bookmarkEnd>) are stripped.
 * - Nested rPr changes inside a single hyperlink emit nested pairs, which
 *   most translators can keep intact but will look noisy on highly-styled
 *   paragraphs.
 */

export type OoxmlTagKind = "open" | "close" | "empty";

export interface OoxmlTag {
  id: number;
  kind: OoxmlTagKind;
  /** Open/close placeholders share this id so a rebuilder can match them. */
  pair_id?: number;
  /** What this tag represents in OOXML. */
  ooxml: "run" | "hyperlink" | "br" | "tab";
  /** Raw <w:rPr>…</w:rPr> if the run had explicit properties. */
  run_props?: string;
  /** r:id of the hyperlink relationship if this is a hyperlink wrapper. */
  hyperlink_rid?: string;
}

export interface OoxmlParagraphSegment {
  /** Paragraph index in document.xml, 0-based across w:p elements. */
  para_index: number;
  /** Segment text with {N} placeholder markers. */
  plain_text: string;
  tags: OoxmlTag[];
  /** Original <w:p>…</w:p> verbatim so the export side can reuse the wrapper. */
  original_para_xml: string;
  /** Inner pPr (paragraph style/numbering) extracted for convenience. */
  p_pr?: string;
}

const PARA_RE = /<w:p\b[^>]*\/>|<w:p\b[^>]*>([\s\S]*?)<\/w:p\s*>/g;

function decodeXmlText(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function encodeXmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Parse a single <w:p> body into a segment-friendly representation.
 * Returns null if the paragraph has no text-bearing content.
 */
function parseParagraph(
  innerXml: string,
  paraIndex: number,
  fullParaXml: string,
  startId: number,
): OoxmlParagraphSegment | null {
  const tags: OoxmlTag[] = [];
  let nextId = startId;
  let plain = "";

  // Extract pPr (paragraph properties) once.
  const pPrMatch = innerXml.match(/<w:pPr\b[\s\S]*?<\/w:pPr\s*>/);
  const pPr = pPrMatch?.[0];

  // Walk children of <w:p> in order. We only care about:
  //   <w:r> ... </w:r>
  //   <w:hyperlink ...> ... </w:hyperlink>
  // Anything else (bookmarks, sectPr, etc.) is skipped.
  const CHILD_RE =
    /<w:hyperlink\b([^>]*)>([\s\S]*?)<\/w:hyperlink\s*>|<w:r\b[^>]*>([\s\S]*?)<\/w:r\s*>/g;

  for (const m of innerXml.matchAll(CHILD_RE)) {
    if (m[0].startsWith("<w:hyperlink")) {
      const attrs = m[1] ?? "";
      const linkInner = m[2] ?? "";
      const ridMatch = attrs.match(/r:id="([^"]+)"/);
      const rid = ridMatch?.[1];

      const openId = nextId++;
      const closeId = nextId++;
      tags.push({ id: openId, kind: "open", pair_id: openId, ooxml: "hyperlink", hyperlink_rid: rid });
      plain += `{${openId}}`;

      // Recurse into the hyperlink's inner runs.
      const inner = parseRunSequence(linkInner, nextId);
      plain += inner.plain;
      tags.push(...inner.tags);
      nextId = inner.nextId;

      tags.push({ id: closeId, kind: "close", pair_id: openId, ooxml: "hyperlink", hyperlink_rid: rid });
      plain += `{${closeId}}`;
    } else {
      // <w:r> at the paragraph level (not inside a hyperlink).
      const result = parseRun(m[0], nextId);
      if (result) {
        plain += result.plain;
        tags.push(...result.tags);
        nextId = result.nextId;
      }
    }
  }

  if (plain.replace(/\{\d+\}/g, "").trim().length === 0) {
    return null;
  }

  return {
    para_index: paraIndex,
    plain_text: plain.replace(/\s+/g, " ").trim(),
    tags,
    original_para_xml: fullParaXml,
    p_pr: pPr,
  };
}

interface RunResult {
  plain: string;
  tags: OoxmlTag[];
  nextId: number;
}

/**
 * Parse a single <w:r>…</w:r> run, returning its plain-text contribution
 * (with optional open/close placeholders if the run carries rPr or has
 * br/tab) plus tag entries.
 */
function parseRun(runXml: string, startId: number): RunResult | null {
  const innerMatch = runXml.match(/^<w:r\b[^>]*>([\s\S]*)<\/w:r\s*>$/);
  if (!innerMatch) return null;
  const inner = innerMatch[1];

  const rPrMatch = inner.match(/<w:rPr\b[\s\S]*?<\/w:rPr\s*>/);
  const rPr = rPrMatch?.[0];
  const hasRPr = rPr !== undefined && rPr.length > 0 && /<w:[a-z]/.test(rPr);

  const tags: OoxmlTag[] = [];
  let nextId = startId;
  let plain = "";

  // Pull out text/break/tab children in order.
  const CHILD_RE = /<w:t\b[^>]*>([\s\S]*?)<\/w:t\s*>|<w:br\b[^/]*\/>|<w:tab\b[^/]*\/>/g;
  let textChunks = "";
  const empties: Array<{ kind: "br" | "tab" }> = [];

  for (const c of inner.matchAll(CHILD_RE)) {
    const tag = c[0];
    if (tag.startsWith("<w:t")) {
      textChunks += decodeXmlText(c[1] ?? "");
    } else if (tag.startsWith("<w:br")) {
      empties.push({ kind: "br" });
    } else if (tag.startsWith("<w:tab")) {
      empties.push({ kind: "tab" });
    }
  }

  // Emit text segment first, wrapped in placeholders if the run is styled.
  if (textChunks.length > 0) {
    if (hasRPr) {
      const openId = nextId++;
      const closeId = nextId++;
      tags.push({ id: openId, kind: "open", pair_id: openId, ooxml: "run", run_props: rPr });
      plain += `{${openId}}${textChunks}{${closeId}}`;
      tags.push({ id: closeId, kind: "close", pair_id: openId, ooxml: "run", run_props: rPr });
    } else {
      plain += textChunks;
    }
  }

  // Emit empty markers for br/tab AFTER the text portion (their positional
  // semantics inside a run are typically end-of-run for headings).
  for (const e of empties) {
    const id = nextId++;
    tags.push({ id, kind: "empty", ooxml: e.kind, run_props: hasRPr ? rPr : undefined });
    plain += `{${id}}`;
  }

  if (plain.length === 0) return null;
  return { plain, tags, nextId };
}

function parseRunSequence(xml: string, startId: number): RunResult {
  let nextId = startId;
  let plain = "";
  const tags: OoxmlTag[] = [];
  for (const m of xml.matchAll(/<w:r\b[^>]*>([\s\S]*?)<\/w:r\s*>/g)) {
    const r = parseRun(m[0], nextId);
    if (!r) continue;
    plain += r.plain;
    tags.push(...r.tags);
    nextId = r.nextId;
  }
  return { plain, tags, nextId };
}

/**
 * Walk every <w:p> in document.xml and produce one OoxmlParagraphSegment
 * per paragraph that has text content. Skips empty paragraphs (section
 * breaks, blank lines).
 */
export function extractOoxmlParagraphs(documentXml: string): OoxmlParagraphSegment[] {
  const out: OoxmlParagraphSegment[] = [];
  let paraIndex = -1;
  for (const m of documentXml.matchAll(PARA_RE)) {
    paraIndex += 1;
    const inner = m[1];
    if (inner === undefined) continue; // self-closing <w:p/>
    const seg = parseParagraph(inner, paraIndex, m[0], 1);
    if (seg) out.push(seg);
  }
  return out;
}

/**
 * Rebuild the body of a <w:p> from the translator's text + the tag inventory.
 * The translator's text contains {N} placeholders. We expand each to the
 * matching OOXML run / hyperlink / break.
 *
 * Returns the inner XML (everything that goes between <w:p> and </w:p>),
 * including the original pPr block so paragraph style survives.
 */
export function rebuildParagraphBody(
  translated: string,
  tags: OoxmlTag[],
  pPr: string | undefined,
): string {
  const byId = new Map<number, OoxmlTag>();
  for (const t of tags) byId.set(t.id, t);

  const parts: string[] = [];
  if (pPr) parts.push(pPr);

  // Walk the translated string, emitting runs as we go.
  // State machine: we track currently-open formatting (rPr stack) and
  // hyperlink wrapper. Each text chunk emits a <w:r> with the active rPr.

  interface Open {
    pair_id: number;
    ooxml: "run" | "hyperlink";
    run_props?: string;
    hyperlink_rid?: string;
    // For hyperlinks we collect the inner runs and emit at close time.
    pendingChildren?: string[];
  }

  const stack: Open[] = [];

  function emitText(text: string) {
    if (text.length === 0) return;
    const inHyperlink = stack.findLast((s) => s.ooxml === "hyperlink");
    const activeRun = stack.findLast((s) => s.ooxml === "run");
    const rPr = activeRun?.run_props ?? "";
    const safe = encodeXmlText(text);
    const run = `<w:r>${rPr}<w:t xml:space="preserve">${safe}</w:t></w:r>`;
    if (inHyperlink && inHyperlink.pendingChildren) {
      inHyperlink.pendingChildren.push(run);
    } else {
      parts.push(run);
    }
  }

  function emitEmpty(tag: OoxmlTag) {
    const inner =
      tag.ooxml === "br" ? "<w:br/>" : tag.ooxml === "tab" ? "<w:tab/>" : "";
    if (!inner) return;
    const rPr = tag.run_props ?? "";
    const run = `<w:r>${rPr}${inner}</w:r>`;
    const inHyperlink = stack.findLast((s) => s.ooxml === "hyperlink");
    if (inHyperlink && inHyperlink.pendingChildren) {
      inHyperlink.pendingChildren.push(run);
    } else {
      parts.push(run);
    }
  }

  const TOKEN_RE = /\{(\d+)\}/g;
  let cursor = 0;
  for (const m of translated.matchAll(TOKEN_RE)) {
    const start = m.index ?? 0;
    if (start > cursor) emitText(translated.slice(cursor, start));
    const id = Number(m[1]);
    const tag = byId.get(id);
    cursor = start + m[0].length;
    if (!tag) continue; // unknown placeholder — drop silently

    if (tag.kind === "open") {
      stack.push({
        pair_id: tag.pair_id ?? id,
        ooxml: tag.ooxml === "run" || tag.ooxml === "hyperlink" ? tag.ooxml : "run",
        run_props: tag.run_props,
        hyperlink_rid: tag.hyperlink_rid,
        pendingChildren: tag.ooxml === "hyperlink" ? [] : undefined,
      });
    } else if (tag.kind === "close") {
      // Close the matching open from the top of the stack.
      const idx = stack.findLastIndex((s) => s.pair_id === (tag.pair_id ?? id));
      if (idx === -1) continue;
      const closing = stack[idx];
      stack.splice(idx, 1);
      if (closing.ooxml === "hyperlink") {
        const ridAttr = closing.hyperlink_rid ? ` r:id="${closing.hyperlink_rid}"` : "";
        const inner = (closing.pendingChildren ?? []).join("");
        const wrapper = `<w:hyperlink${ridAttr}>${inner}</w:hyperlink>`;
        const stillInside = stack.findLast((s) => s.ooxml === "hyperlink");
        if (stillInside && stillInside.pendingChildren) {
          stillInside.pendingChildren.push(wrapper);
        } else {
          parts.push(wrapper);
        }
      }
    } else if (tag.kind === "empty") {
      emitEmpty(tag);
    }
  }
  if (cursor < translated.length) emitText(translated.slice(cursor));

  // Any unclosed hyperlinks: emit what we have.
  while (stack.length > 0) {
    const top = stack.pop()!;
    if (top.ooxml === "hyperlink") {
      const ridAttr = top.hyperlink_rid ? ` r:id="${top.hyperlink_rid}"` : "";
      const inner = (top.pendingChildren ?? []).join("");
      parts.push(`<w:hyperlink${ridAttr}>${inner}</w:hyperlink>`);
    }
  }

  return parts.join("");
}
