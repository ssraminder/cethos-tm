/**
 * XLSX tag handling — same approach as ooxml-tags.ts but for SpreadsheetML.
 *
 * Excel stores translatable text in two places:
 *   1. xl/sharedStrings.xml — a shared strings table. Most cell text lives
 *      here, referenced from sheets by index.
 *   2. xl/worksheets/sheet*.xml — inline strings (<is>...</is>) for cells
 *      with t="inlineStr".
 *
 * Both forms wrap their content in <si>...</si> or <is>...</is> with the
 * same internal shape:
 *
 *   Plain text:
 *     <si><t>Hello</t></si>
 *
 *   Rich text with runs:
 *     <si>
 *       <r><rPr><b/></rPr><t>Bold</t></r>
 *       <r><t> normal</t></r>
 *     </si>
 *
 * We extract one segment per <si>/<is>, emitting {N} placeholders for any
 * rich-text run with explicit <rPr>. Plain runs without rPr are inlined.
 *
 * Numeric cells, formulas, and dates have no translatable text and are
 * skipped. Cell comments (xl/comments*.xml) are not currently extracted —
 * V2 if needed.
 */

import type { OoxmlTag } from "./ooxml-tags";

export type XlsxLocation =
  | { kind: "shared"; index: number }
  | { kind: "inline"; sheet: string; cell: string };

export interface XlsxStringSegment {
  /** Sequence number (1-based), assigned by walk order. */
  seq: number;
  /** Where to find this string at export time. */
  location: XlsxLocation;
  /** Segment text with {N} placeholders for rich-text runs. */
  plain_text: string;
  /** Tag inventory (only "run" type entries appear here). */
  tags: OoxmlTag[];
  /** Original <si>/<is> body (everything between the wrapping tags). */
  original_inner_xml: string;
}

const SI_RE = /<si\b[^>]*>([\s\S]*?)<\/si\s*>|<si\b[^>]*\/>/g;
const IS_RE = /<is\b[^>]*>([\s\S]*?)<\/is\s*>/g;

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
 * Parse the inner of an <si> or <is> block into segment text + tags.
 *
 * Two cases:
 *   - Plain: just <t>text</t> children
 *   - Rich:  <r><rPr>...</rPr><t>text</t></r> children
 *
 * Returns null if the inner has no text content (rare — usually means an
 * empty cell that shouldn't have been emitted as a string).
 */
function parseStringInner(
  inner: string,
  startId: number,
): { plain_text: string; tags: OoxmlTag[] } | null {
  const tags: OoxmlTag[] = [];
  let nextId = startId;
  let plain = "";

  // Pull <r>...</r> rich runs first (in order). If there are none, fall
  // back to bare <t>text</t> children.
  const RICH_RE = /<r\b[^>]*>([\s\S]*?)<\/r\s*>/g;
  const richMatches = [...inner.matchAll(RICH_RE)];

  if (richMatches.length > 0) {
    for (const m of richMatches) {
      const rInner = m[1];
      const rPrMatch = rInner.match(/<rPr\b[\s\S]*?<\/rPr\s*>/);
      const rPr = rPrMatch?.[0];
      const hasRPr = rPr !== undefined && rPr.length > 0;
      const tMatches = [...rInner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t\s*>/g)];
      const text = tMatches.map((tm) => decodeXmlText(tm[1] ?? "")).join("");
      if (text.length === 0) continue;
      if (hasRPr) {
        const openId = nextId++;
        const closeId = nextId++;
        tags.push({ id: openId, kind: "open", pair_id: openId, ooxml: "run", run_props: rPr });
        plain += `{${openId}}${text}{${closeId}}`;
        tags.push({ id: closeId, kind: "close", pair_id: openId, ooxml: "run", run_props: rPr });
      } else {
        plain += text;
      }
    }
  } else {
    // Plain string: concatenate any <t> children at the top level.
    for (const m of inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t\s*>/g)) {
      plain += decodeXmlText(m[1] ?? "");
    }
  }

  if (plain.replace(/\{\d+\}/g, "").length === 0) return null;
  return { plain_text: plain, tags };
}

/**
 * Walk xl/sharedStrings.xml in <si> order. Returns one segment per <si>.
 * Empty/whitespace-only strings are still emitted (with empty plain_text)
 * so the index alignment with the original file is preserved.
 */
export function extractSharedStrings(
  sharedStringsXml: string,
  startSeq: number,
): { segments: XlsxStringSegment[]; nextSeq: number } {
  const segments: XlsxStringSegment[] = [];
  let seq = startSeq;
  let index = -1;
  for (const m of sharedStringsXml.matchAll(SI_RE)) {
    index += 1;
    const inner = m[1] ?? "";
    const parsed = parseStringInner(inner, 1);
    if (!parsed) {
      // Preserve the slot — empty string at this index.
      segments.push({
        seq: seq++,
        location: { kind: "shared", index },
        plain_text: "",
        tags: [],
        original_inner_xml: inner,
      });
      continue;
    }
    segments.push({
      seq: seq++,
      location: { kind: "shared", index },
      plain_text: parsed.plain_text,
      tags: parsed.tags,
      original_inner_xml: inner,
    });
  }
  return { segments, nextSeq: seq };
}

/**
 * Walk inline strings in a single sheet XML (<is> elements inside cells
 * with t="inlineStr"). Returns one segment per inline string.
 */
export function extractInlineStrings(
  sheetXml: string,
  sheetName: string,
  startSeq: number,
): { segments: XlsxStringSegment[]; nextSeq: number } {
  const segments: XlsxStringSegment[] = [];
  let seq = startSeq;

  // We need cell ref (e.g. "A1") for each <is>. Walk <c r="..." t="inlineStr">
  // ... </c> blocks.
  const CELL_RE = /<c\b([^>]*?)t="inlineStr"([^>]*)>([\s\S]*?)<\/c\s*>/g;
  for (const m of sheetXml.matchAll(CELL_RE)) {
    const attrsBefore = m[1] ?? "";
    const attrsAfter = m[2] ?? "";
    const cellInner = m[3] ?? "";
    const allAttrs = `${attrsBefore} ${attrsAfter}`;
    const refMatch = allAttrs.match(/\br="([^"]+)"/);
    const cellRef = refMatch?.[1] ?? "";

    const isMatch = cellInner.match(/<is\b[^>]*>([\s\S]*?)<\/is\s*>/);
    if (!isMatch) continue;
    const inner = isMatch[1] ?? "";
    const parsed = parseStringInner(inner, 1);
    if (!parsed) continue;
    segments.push({
      seq: seq++,
      location: { kind: "inline", sheet: sheetName, cell: cellRef },
      plain_text: parsed.plain_text,
      tags: parsed.tags,
      original_inner_xml: inner,
    });
  }

  return { segments, nextSeq: seq };
}

/**
 * Rebuild the inner XML of an <si>/<is> from the translator's text. If the
 * tag inventory has rich-text runs, emit the corresponding <r><rPr>...</rPr>
 * <t>...</t></r> sequence; otherwise emit a single <t>text</t>.
 *
 * Returns the inner XML (everything that goes between <si>...</si>).
 */
export function rebuildStringInner(translated: string, tags: OoxmlTag[]): string {
  if (tags.length === 0) {
    // Plain string. Use xml:space="preserve" so leading/trailing spaces
    // (common in Excel) don't get normalized away.
    return `<t xml:space="preserve">${encodeXmlText(translated)}</t>`;
  }

  const byId = new Map<number, OoxmlTag>();
  for (const t of tags) byId.set(t.id, t);

  interface Open {
    pair_id: number;
    run_props?: string;
  }
  const stack: Open[] = [];
  const parts: string[] = [];
  let textBuffer = "";

  function flushText() {
    if (textBuffer.length === 0) return;
    const active = stack[stack.length - 1];
    const safe = encodeXmlText(textBuffer);
    if (active && active.run_props) {
      parts.push(`<r>${active.run_props}<t xml:space="preserve">${safe}</t></r>`);
    } else {
      parts.push(`<r><t xml:space="preserve">${safe}</t></r>`);
    }
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

    flushText();
    if (tag.kind === "open") {
      stack.push({ pair_id: tag.pair_id ?? id, run_props: tag.run_props });
    } else if (tag.kind === "close") {
      const idx = stack.findIndex((s) => s.pair_id === (tag.pair_id ?? id));
      if (idx !== -1) stack.splice(idx, 1);
    }
  }
  if (cursor < translated.length) textBuffer += translated.slice(cursor);
  flushText();

  // If we built rich runs, return them. Otherwise a translator stripped
  // every placeholder and the result is plain text — emit one <t> wrapper.
  if (parts.length === 0) {
    return `<t xml:space="preserve">${encodeXmlText(translated)}</t>`;
  }
  return parts.join("");
}

/**
 * Splice a translated <si>/<is> body back into the original XML, replacing
 * the inner of the matching element. The wrapping tags ([si]...[/si] or
 * [is]...[/is]) are preserved verbatim including any attributes.
 *
 * For shared strings: pass the full xl/sharedStrings.xml and an array of
 * (index, newInner) pairs. We walk <si> elements and replace by index.
 */
export function spliceSharedStrings(
  xml: string,
  replacements: Map<number, string>,
): string {
  let index = -1;
  const out: string[] = [];
  let cursor = 0;
  for (const m of xml.matchAll(SI_RE)) {
    index += 1;
    const start = m.index ?? 0;
    out.push(xml.slice(cursor, start));
    const fullSi = m[0];
    const innerOriginal = m[1];
    const r = replacements.get(index);
    if (r === undefined || innerOriginal === undefined) {
      out.push(fullSi);
    } else {
      // Reuse the original opening tag (preserves attributes).
      const openMatch = fullSi.match(/^<si\b[^>]*>/);
      const open = openMatch?.[0] ?? "<si>";
      out.push(`${open}${r}</si>`);
    }
    cursor = start + fullSi.length;
  }
  out.push(xml.slice(cursor));
  return out.join("");
}

/**
 * Same as spliceSharedStrings but for inline strings in sheet XML. Replaces
 * by cell reference.
 */
export function spliceInlineStrings(
  sheetXml: string,
  replacements: Map<string, string>, // cellRef -> new <is> inner
): string {
  return sheetXml.replace(
    /<c\b([^>]*?)t="inlineStr"([^>]*)>([\s\S]*?)<\/c\s*>/g,
    (full, attrsBefore: string, attrsAfter: string, cellInner: string) => {
      const allAttrs = `${attrsBefore} ${attrsAfter}`;
      const refMatch = allAttrs.match(/\br="([^"]+)"/);
      const cellRef = refMatch?.[1] ?? "";
      const r = replacements.get(cellRef);
      if (r === undefined) return full;
      const newCellInner = cellInner.replace(
        /<is\b[^>]*>[\s\S]*?<\/is\s*>/,
        `<is>${r}</is>`,
      );
      return `<c${attrsBefore}t="inlineStr"${attrsAfter}>${newCellInner}</c>`;
    },
  );
}

export type { OoxmlTag };
