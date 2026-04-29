/**
 * PPTX (DrawingML) tag handling. Same pattern as ooxml-tags.ts but for the
 * PowerPoint XML schema:
 *
 *   <a:p>       paragraph
 *   <a:r>       run
 *   <a:rPr>     run properties (bold, italic, font, hyperlink)
 *   <a:t>       text content
 *   <a:br>      line break
 *   <a:fld>     field (page number, date)
 *   <a:hlinkClick> hyperlink (LIVES INSIDE rPr — different from Word!)
 *
 * Translatable text lives in <p:sp>/<p:txBody>/<a:p> chains across:
 *   - ppt/slides/slide*.xml         (slide content)
 *   - ppt/notesSlides/notesSlide*.xml (speaker notes)
 *   - Tables (<a:tbl>) inside slides — cells contain <a:p> paragraphs
 *
 * We extract one segment per <a:p>. Run formatting (rPr) becomes {N}
 * placeholder pairs; <a:fld> and <a:br> become empty placeholders.
 */

import type { OoxmlTag } from "./ooxml-tags";

export interface PptxParagraphSegment {
  /** File path within the .pptx zip, e.g. "ppt/slides/slide1.xml". */
  file_path: string;
  /** Paragraph index within the file (0-based, across all <a:p> in source order). */
  para_index: number;
  /** Segment text with {N} placeholders. */
  plain_text: string;
  tags: OoxmlTag[];
  original_para_xml: string;
}

const PARA_RE = /<a:p\b[^>]*\/>|<a:p\b[^>]*>([\s\S]*?)<\/a:p\s*>/g;
const RUN_RE = /<a:r\b[^>]*>[\s\S]*?<\/a:r\s*>/g;
const FLD_RE = /<a:fld\b[^>]*>[\s\S]*?<\/a:fld\s*>|<a:fld\b[^>]*\/>/g;
const BR_RE = /<a:br\b[^>]*\/?>(?:<\/a:br\s*>)?/g;

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

interface State {
  nextId: number;
}

/**
 * An <a:rPr> is "meaningful" (worth a placeholder) only if it carries
 * formatting beyond a default lang/dirty marker. PowerPoint emits
 * <a:rPr lang="en-US"/> on every run regardless of styling — those
 * shouldn't generate placeholders.
 */
function isMeaningfulRPr(rPr: string): boolean {
  // 1. Any child element under rPr means real formatting (hlinkClick,
  //    solidFill, latin, cs, ea, etc.).
  if (/<a:rPr\b[^>]*>\s*<a:/.test(rPr)) return true;
  // 2. Bold/italic/underline/strike/superscript/baseline/font-size
  //    attributes on the rPr tag itself.
  const stylingAttrs = /\b(?:b|i|u|strike|sz|baseline|cap|spc|kumimoji|kern|normalizeH)="[^"]*"/;
  if (stylingAttrs.test(rPr)) return true;
  // 3. Otherwise it's just a lang/dirty/smtClean carrier — default style.
  return false;
}

function parseRun(runXml: string, state: State): { plain: string; tags: OoxmlTag[] } | null {
  const innerMatch = runXml.match(/^<a:r\b[^>]*>([\s\S]*)<\/a:r\s*>$/);
  if (!innerMatch) return null;
  const inner = innerMatch[1];

  const rPrMatch = inner.match(/<a:rPr\b[\s\S]*?<\/a:rPr\s*>|<a:rPr\b[^>]*\/>/);
  const rPr = rPrMatch?.[0];
  const hasMeaningfulRPr = !!rPr && isMeaningfulRPr(rPr);

  const tMatches = [...inner.matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t\s*>/g)];
  const text = tMatches.map((tm) => decodeXmlText(tm[1] ?? "")).join("");
  if (text.length === 0) return null;

  const tags: OoxmlTag[] = [];
  let plain = "";

  if (hasMeaningfulRPr) {
    const openId = state.nextId++;
    const closeId = state.nextId++;
    tags.push({ id: openId, kind: "open", pair_id: openId, ooxml: "run", run_props: rPr });
    plain += `{${openId}}${text}{${closeId}}`;
    tags.push({ id: closeId, kind: "close", pair_id: openId, ooxml: "run", run_props: rPr });
  } else {
    plain += text;
  }
  return { plain, tags };
}

function parseField(fldXml: string, state: State): { plain: string; tags: OoxmlTag[] } {
  const id = state.nextId++;
  return {
    plain: `{${id}}`,
    tags: [{ id, kind: "empty", ooxml: "verbatim", verbatim_xml: fldXml }],
  };
}

function parseBr(brXml: string, state: State): { plain: string; tags: OoxmlTag[] } {
  const id = state.nextId++;
  return {
    plain: `{${id}}`,
    tags: [{ id, kind: "empty", ooxml: "br", verbatim_xml: brXml }],
  };
}

/**
 * Parse a single <a:p> body. Returns null if the paragraph has no text.
 */
function parseParagraph(
  fullParaXml: string,
  innerXml: string,
  paraIndex: number,
  filePath: string,
  state: State,
): PptxParagraphSegment | null {
  // <a:pPr> at the start of the paragraph is preserved on rebuild via
  // original_para_xml (we replace the paragraph wholesale on export). Our
  // job here is just to enumerate runs/fields/breaks in order.

  interface Hit {
    start: number;
    end: number;
    type: "run" | "fld" | "br";
    text: string;
  }
  const hits: Hit[] = [];
  for (const m of innerXml.matchAll(RUN_RE)) {
    hits.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, type: "run", text: m[0] });
  }
  for (const m of innerXml.matchAll(FLD_RE)) {
    hits.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, type: "fld", text: m[0] });
  }
  for (const m of innerXml.matchAll(BR_RE)) {
    hits.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, type: "br", text: m[0] });
  }
  hits.sort((a, b) => a.start - b.start);

  let plain = "";
  const tags: OoxmlTag[] = [];

  for (const h of hits) {
    let r: { plain: string; tags: OoxmlTag[] } | null;
    if (h.type === "run") {
      r = parseRun(h.text, state);
    } else if (h.type === "fld") {
      r = parseField(h.text, state);
    } else {
      r = parseBr(h.text, state);
    }
    if (!r) continue;
    plain += r.plain;
    tags.push(...r.tags);
  }

  if (plain.replace(/\{\d+\}/g, "").trim().length === 0) {
    // Tag-only paragraph: still emit if it has any tags (e.g. a single br).
    if (tags.length > 0) {
      return {
        file_path: filePath,
        para_index: paraIndex,
        plain_text: plain.trim(),
        tags,
        original_para_xml: fullParaXml,
      };
    }
    return null;
  }

  return {
    file_path: filePath,
    para_index: paraIndex,
    plain_text: plain.replace(/\s+/g, " ").trim(),
    tags,
    original_para_xml: fullParaXml,
  };
}

/**
 * Walk every <a:p> in a slide / notesSlide / etc. Returns segments
 * tagged with the file path so the export can splice back in the right
 * place.
 */
export function extractPptxParagraphs(
  fileXml: string,
  filePath: string,
): PptxParagraphSegment[] {
  const out: PptxParagraphSegment[] = [];
  let paraIndex = -1;
  const state: State = { nextId: 1 };
  for (const m of fileXml.matchAll(PARA_RE)) {
    paraIndex += 1;
    const inner = m[1];
    if (inner === undefined) continue;
    const seg = parseParagraph(m[0], inner, paraIndex, filePath, state);
    if (seg) out.push(seg);
    state.nextId = 1; // reset per paragraph for readable {N}
  }
  return out;
}

/**
 * Rebuild a paragraph body (everything that goes between <a:p> and </a:p>)
 * from translated text + tag inventory. Preserves the original <a:pPr> if
 * present.
 */
export function rebuildPptxParagraphBody(
  originalInner: string,
  translated: string,
  tags: OoxmlTag[],
): string {
  const byId = new Map<number, OoxmlTag>();
  for (const t of tags) byId.set(t.id, t);

  // Preserve <a:pPr> from the original (alignment, list level, etc.)
  const pPrMatch = originalInner.match(/<a:pPr\b[\s\S]*?<\/a:pPr\s*>|<a:pPr\b[^>]*\/>/);
  const pPr = pPrMatch?.[0] ?? "";

  // Track active rPr from open placeholders.
  const stack: Array<{ pair_id: number; run_props?: string }> = [];
  const parts: string[] = [];
  if (pPr) parts.push(pPr);
  let textBuffer = "";

  function flushText() {
    if (textBuffer.length === 0) return;
    const top = stack[stack.length - 1];
    const rPr = top?.run_props ?? "<a:rPr/>";
    const safe = encodeXmlText(textBuffer);
    parts.push(`<a:r>${rPr}<a:t>${safe}</a:t></a:r>`);
    textBuffer = "";
  }

  const TOKEN_RE = /\{(\d+)\}/g;
  let cursor = 0;
  for (const m of translated.matchAll(TOKEN_RE)) {
    const start = m.index ?? 0;
    if (start > cursor) textBuffer += translated.slice(cursor, start);
    const id = Number(m[1]);
    const tag = byId.get(id);
    cursor = start + m[0].length;
    if (!tag) continue;

    if (tag.kind === "open") {
      flushText();
      stack.push({ pair_id: tag.pair_id ?? id, run_props: tag.run_props });
    } else if (tag.kind === "close") {
      flushText();
      const idx = stack.findLastIndex((s) => s.pair_id === (tag.pair_id ?? id));
      if (idx !== -1) stack.splice(idx, 1);
    } else if (tag.kind === "empty") {
      flushText();
      if (tag.ooxml === "br") {
        parts.push(tag.verbatim_xml ?? "<a:br/>");
      } else if (tag.ooxml === "verbatim") {
        parts.push(tag.verbatim_xml ?? "");
      }
    }
  }
  if (cursor < translated.length) textBuffer += translated.slice(cursor);
  flushText();

  return parts.join("");
}

/**
 * Splice translated paragraph bodies back into the original file XML.
 * Keyed by paragraph index so it matches the extraction walk order.
 */
export function splicePptxParagraphs(
  fileXml: string,
  replacements: Map<number, { translated: string; tags: OoxmlTag[] }>,
): string {
  let paraIndex = -1;
  const out: string[] = [];
  let cursor = 0;
  for (const m of fileXml.matchAll(PARA_RE)) {
    paraIndex += 1;
    const start = m.index ?? 0;
    out.push(fileXml.slice(cursor, start));
    const fullPara = m[0];
    const inner = m[1];
    const r = replacements.get(paraIndex);
    if (r === undefined || inner === undefined) {
      out.push(fullPara);
      cursor = start + fullPara.length;
      continue;
    }
    const open = fullPara.match(/^<a:p\b[^>]*>/)?.[0] ?? "<a:p>";
    const newBody = rebuildPptxParagraphBody(inner, r.translated, r.tags);
    out.push(`${open}${newBody}</a:p>`);
    cursor = start + fullPara.length;
  }
  out.push(fileXml.slice(cursor));
  return out.join("");
}
