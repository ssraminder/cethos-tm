/**
 * OOXML run-level tag handling for DOCX round-trip.
 *
 * V3 scope: in addition to V2's run formatting + hyperlinks + br/tab, we now
 * preserve a wide set of "untranslatable inline" elements as verbatim
 * placeholders so they survive the round-trip:
 *   - <w:drawing> ... </w:drawing>      (images, charts, shapes)
 *   - <w:object> ... </w:object>        (embedded OLE objects)
 *   - <w:pict>   ... </w:pict>          (legacy drawings)
 *   - <m:oMath>  ... </m:oMath>         (math equations)
 *   - <w:fldSimple ...>...</w:fldSimple>(simple field — page number, date)
 *   - <w:fldChar .../>                  (complex field begin/separate/end)
 *   - <w:instrText>...</w:instrText>    (field instructions)
 *   - <w:footnoteReference .../>        (footnote anchor)
 *   - <w:endnoteReference .../>         (endnote anchor)
 *   - <w:commentReference .../>         (comment anchor)
 *   - <w:bookmarkStart .../>            (bookmark start)
 *   - <w:bookmarkEnd .../>              (bookmark end)
 *   - <w:commentRangeStart .../>        (comment range start)
 *   - <w:commentRangeEnd .../>          (comment range end)
 *   - <w:permStart .../>                (permission range)
 *   - <w:permEnd .../>
 *
 * V3 also descends into <w:ins> and <w:del> wrappers transparently (their
 * inner runs are extracted as normal). Note: this effectively "accepts"
 * tracked changes on round-trip — for jobs where tracked changes must
 * survive, accept them in Word before upload.
 *
 * Elements still dropped silently:
 *   - <w:proofErr .../>  (proofing squiggles — not content)
 *   - <w:smartTag>...</w:smartTag>  (rare in modern docs)
 *   - <w:sectPr>...</w:sectPr> at paragraph level (kept inside pPr)
 */

export type OoxmlTagKind = "open" | "close" | "empty";

export interface OoxmlTag {
  id: number;
  kind: OoxmlTagKind;
  /** Open/close placeholders share this id so a rebuilder can match them. */
  pair_id?: number;
  /** What this tag represents in OOXML. */
  ooxml: "run" | "hyperlink" | "br" | "tab" | "verbatim";
  /** Raw <w:rPr>…</w:rPr> if the run had explicit properties. */
  run_props?: string;
  /** r:id of the hyperlink relationship if this is a hyperlink wrapper. */
  hyperlink_rid?: string;
  /** For 'verbatim' empties: the original XML to splat back on rebuild. */
  verbatim_xml?: string;
}

export interface OoxmlParagraphSegment {
  para_index: number;
  plain_text: string;
  tags: OoxmlTag[];
  original_para_xml: string;
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
 * Elements that appear at PARAGRAPH level (siblings of <w:r>) and should
 * round-trip as verbatim empty placeholders.
 */
const PARA_LEVEL_VERBATIM = [
  "w:bookmarkStart",
  "w:bookmarkEnd",
  "w:commentRangeStart",
  "w:commentRangeEnd",
  "w:permStart",
  "w:permEnd",
  "w:fldSimple",
];

/**
 * Elements that appear INSIDE <w:r> and should round-trip as verbatim
 * empty placeholders (handled in parseRun).
 */
const RUN_LEVEL_VERBATIM = [
  "w:drawing",
  "w:object",
  "w:pict",
  "w:fldChar",
  "w:instrText",
  "w:footnoteReference",
  "w:endnoteReference",
  "w:commentReference",
  "m:oMath",
];

/**
 * Build a regex that matches any of these element types — both self-closing
 * (<x/>) and paired (<x>...</x>) forms.
 */
function buildVerbatimRegex(elements: string[]): RegExp {
  const escaped = elements.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const alternation = escaped.join("|");
  // Match either <x .../> or <x ...>...</x>
  return new RegExp(`<(${alternation})\\b[^>]*?/>|<(${alternation})\\b[^>]*?>[\\s\\S]*?</\\2\\s*>`, "g");
}

const PARA_VERBATIM_RE = buildVerbatimRegex(PARA_LEVEL_VERBATIM);

/**
 * Elements we descend into transparently at paragraph level: their inner
 * <w:r> runs are extracted as normal. Used for tracked changes (<w:ins>,
 * <w:del>) and smart tags.
 */
const TRANSPARENT_WRAPPERS = ["w:ins", "w:del", "w:smartTag"];

/**
 * Strip elements we want to drop entirely (no placeholder, no preservation).
 */
const DROP_ELEMENTS = ["w:proofErr"];

function preprocessParagraphInner(inner: string): string {
  let out = inner;
  // Drop proofing markers entirely.
  for (const el of DROP_ELEMENTS) {
    const re = new RegExp(`<${el}\\b[^>]*?/>`, "g");
    out = out.replace(re, "");
  }
  // Unwrap transparent wrappers, keeping their content.
  for (const el of TRANSPARENT_WRAPPERS) {
    const reSelf = new RegExp(`<${el}\\b[^>]*?/>`, "g");
    out = out.replace(reSelf, "");
    const rePair = new RegExp(`<${el}\\b[^>]*?>([\\s\\S]*?)</${el}\\s*>`, "g");
    out = out.replace(rePair, "$1");
  }
  return out;
}

interface ParseState {
  nextId: number;
}

function parseParagraph(
  rawInner: string,
  paraIndex: number,
  fullParaXml: string,
  state: ParseState,
): OoxmlParagraphSegment | null {
  const tags: OoxmlTag[] = [];
  let plain = "";

  // Pull pPr first, then strip it from the body so it doesn't interfere.
  const pPrMatch = rawInner.match(/<w:pPr\b[\s\S]*?<\/w:pPr\s*>/);
  const pPr = pPrMatch?.[0];
  let body = pPr ? rawInner.replace(pPr, "") : rawInner;

  // Drop proofErr / unwrap ins/del/smartTag.
  body = preprocessParagraphInner(body);

  // Walk the paragraph body in source order, capturing:
  //   - <w:hyperlink>...</w:hyperlink>
  //   - <w:r>...</w:r>
  //   - paragraph-level verbatim elements (bookmarks, comment ranges, etc.)
  //
  // Build an ordered list of matches with their offsets, then process each.
  interface Hit {
    start: number;
    end: number;
    type: "hyperlink" | "run" | "verbatim";
    text: string;
  }

  const hits: Hit[] = [];

  for (const m of body.matchAll(/<w:hyperlink\b[^>]*>[\s\S]*?<\/w:hyperlink\s*>/g)) {
    hits.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, type: "hyperlink", text: m[0] });
  }
  for (const m of body.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r\s*>/g)) {
    hits.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, type: "run", text: m[0] });
  }
  for (const m of body.matchAll(PARA_VERBATIM_RE)) {
    hits.push({
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      type: "verbatim",
      text: m[0],
    });
  }

  // Sort by start position, then drop hits that overlap an earlier longer
  // one (the longer enclosing element wins — handles cases like a
  // bookmarkStart that happens to be inside a hyperlink).
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const accepted: Hit[] = [];
  let lastEnd = -1;
  for (const h of hits) {
    if (h.start < lastEnd) continue;
    accepted.push(h);
    lastEnd = h.end;
  }

  for (const h of accepted) {
    if (h.type === "hyperlink") {
      const attrs = h.text.match(/^<w:hyperlink\b([^>]*)>/)?.[1] ?? "";
      const linkInner = h.text.match(/^<w:hyperlink\b[^>]*>([\s\S]*?)<\/w:hyperlink\s*>$/)?.[1] ?? "";
      const ridMatch = attrs.match(/r:id="([^"]+)"/);
      const rid = ridMatch?.[1];

      const openId = state.nextId++;
      const closeId = state.nextId++;
      tags.push({ id: openId, kind: "open", pair_id: openId, ooxml: "hyperlink", hyperlink_rid: rid });
      plain += `{${openId}}`;

      // Recurse: hyperlink's children are runs (and possibly verbatim
      // elements). Reuse parseParagraphInternal by treating its inner XML
      // as a mini-paragraph body.
      const inner = parseRunSequence(linkInner, state);
      plain += inner.plain;
      tags.push(...inner.tags);

      tags.push({ id: closeId, kind: "close", pair_id: openId, ooxml: "hyperlink", hyperlink_rid: rid });
      plain += `{${closeId}}`;
    } else if (h.type === "run") {
      const r = parseRun(h.text, state);
      if (r) {
        plain += r.plain;
        tags.push(...r.tags);
      }
    } else if (h.type === "verbatim") {
      const id = state.nextId++;
      tags.push({
        id,
        kind: "empty",
        ooxml: "verbatim",
        verbatim_xml: h.text,
      });
      plain += `{${id}}`;
    }
  }

  // Drop paragraphs whose visible text (after removing placeholders) is empty.
  if (plain.replace(/\{\d+\}/g, "").trim().length === 0) {
    // BUT: if the paragraph has any tags (e.g. just a drawing), still emit
    // it so the round-trip preserves the image. Show "(formatting)" as the
    // segment text so the translator sees something.
    if (tags.length > 0) {
      return {
        para_index: paraIndex,
        plain_text: plain.trim(),
        tags,
        original_para_xml: fullParaXml,
        p_pr: pPr,
      };
    }
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
}

function parseRun(runXml: string, state: ParseState): RunResult | null {
  const innerMatch = runXml.match(/^<w:r\b[^>]*>([\s\S]*)<\/w:r\s*>$/);
  if (!innerMatch) return null;
  const inner = innerMatch[1];

  const rPrMatch = inner.match(/<w:rPr\b[\s\S]*?<\/w:rPr\s*>/);
  const rPr = rPrMatch?.[0];
  const hasRPr = rPr !== undefined && rPr.length > 0 && /<w:[a-z]/.test(rPr);

  const tags: OoxmlTag[] = [];
  let plain = "";

  // Walk children in order: <w:t>, <w:br/>, <w:tab/>, and run-level verbatim
  // elements (drawing, footnoteReference, fldChar, instrText, etc.).
  interface Child {
    start: number;
    end: number;
    kind: "text" | "br" | "tab" | "verbatim";
    payload: string;
  }
  const children: Child[] = [];

  for (const m of inner.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t\s*>/g)) {
    children.push({
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      kind: "text",
      payload: decodeXmlText(m[1] ?? ""),
    });
  }
  for (const m of inner.matchAll(/<w:br\b[^/]*\/>/g)) {
    children.push({
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      kind: "br",
      payload: "",
    });
  }
  for (const m of inner.matchAll(/<w:tab\b[^/]*\/>/g)) {
    children.push({
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      kind: "tab",
      payload: "",
    });
  }

  const RUN_VERBATIM_RE = buildVerbatimRegex(RUN_LEVEL_VERBATIM);
  for (const m of inner.matchAll(RUN_VERBATIM_RE)) {
    children.push({
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      kind: "verbatim",
      payload: m[0],
    });
  }

  children.sort((a, b) => a.start - b.start);

  // Group consecutive text children together (simple optimization for
  // adjacent <w:t>s) but emit other children as separate placeholders.
  let textBuffer = "";
  function flushText() {
    if (textBuffer.length === 0) return;
    if (hasRPr) {
      const openId = state.nextId++;
      const closeId = state.nextId++;
      tags.push({ id: openId, kind: "open", pair_id: openId, ooxml: "run", run_props: rPr });
      plain += `{${openId}}${textBuffer}{${closeId}}`;
      tags.push({ id: closeId, kind: "close", pair_id: openId, ooxml: "run", run_props: rPr });
    } else {
      plain += textBuffer;
    }
    textBuffer = "";
  }

  for (const c of children) {
    if (c.kind === "text") {
      textBuffer += c.payload;
    } else if (c.kind === "br") {
      flushText();
      const id = state.nextId++;
      tags.push({ id, kind: "empty", ooxml: "br", run_props: hasRPr ? rPr : undefined });
      plain += `{${id}}`;
    } else if (c.kind === "tab") {
      flushText();
      const id = state.nextId++;
      tags.push({ id, kind: "empty", ooxml: "tab", run_props: hasRPr ? rPr : undefined });
      plain += `{${id}}`;
    } else if (c.kind === "verbatim") {
      flushText();
      // Wrap the verbatim element in a <w:r> on rebuild so it lives inside
      // a run with the original rPr. Store run_props alongside verbatim_xml.
      const id = state.nextId++;
      tags.push({
        id,
        kind: "empty",
        ooxml: "verbatim",
        verbatim_xml: c.payload,
        run_props: hasRPr ? rPr : undefined,
      });
      plain += `{${id}}`;
    }
  }
  flushText();

  if (plain.length === 0) return null;
  return { plain, tags };
}

function parseRunSequence(xml: string, state: ParseState): RunResult {
  let plain = "";
  const tags: OoxmlTag[] = [];
  for (const m of xml.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r\s*>/g)) {
    const r = parseRun(m[0], state);
    if (!r) continue;
    plain += r.plain;
    tags.push(...r.tags);
  }
  return { plain, tags };
}

export function extractOoxmlParagraphs(documentXml: string): OoxmlParagraphSegment[] {
  const out: OoxmlParagraphSegment[] = [];
  let paraIndex = -1;
  const state: ParseState = { nextId: 1 };
  for (const m of documentXml.matchAll(PARA_RE)) {
    paraIndex += 1;
    const inner = m[1];
    if (inner === undefined) continue;
    const seg = parseParagraph(inner, paraIndex, m[0], state);
    if (seg) out.push(seg);
    // Reset id counter per paragraph so {N} numbering stays small + readable.
    state.nextId = 1;
  }
  return out;
}

export function rebuildParagraphBody(
  translated: string,
  tags: OoxmlTag[],
  pPr: string | undefined,
): string {
  const byId = new Map<number, OoxmlTag>();
  for (const t of tags) byId.set(t.id, t);

  const parts: string[] = [];
  if (pPr) parts.push(pPr);

  interface Open {
    pair_id: number;
    ooxml: "run" | "hyperlink";
    run_props?: string;
    hyperlink_rid?: string;
    pendingChildren?: string[];
  }
  const stack: Open[] = [];

  function pushFragment(frag: string) {
    const inHyperlink = stack.findLast((s) => s.ooxml === "hyperlink");
    if (inHyperlink && inHyperlink.pendingChildren) {
      inHyperlink.pendingChildren.push(frag);
    } else {
      parts.push(frag);
    }
  }

  function emitText(text: string) {
    if (text.length === 0) return;
    const activeRun = stack.findLast((s) => s.ooxml === "run");
    const rPr = activeRun?.run_props ?? "";
    const safe = encodeXmlText(text);
    pushFragment(`<w:r>${rPr}<w:t xml:space="preserve">${safe}</w:t></w:r>`);
  }

  function emitEmpty(tag: OoxmlTag) {
    if (tag.ooxml === "br") {
      const rPr = tag.run_props ?? "";
      pushFragment(`<w:r>${rPr}<w:br/></w:r>`);
    } else if (tag.ooxml === "tab") {
      const rPr = tag.run_props ?? "";
      pushFragment(`<w:r>${rPr}<w:tab/></w:r>`);
    } else if (tag.ooxml === "verbatim" && tag.verbatim_xml) {
      // If the verbatim element belongs inside a <w:r>, wrap it; otherwise
      // emit at paragraph level. Heuristic: if run_props is present we know
      // it came from inside a run.
      if (tag.run_props !== undefined || isRunLevelVerbatim(tag.verbatim_xml)) {
        const rPr = tag.run_props ?? "";
        pushFragment(`<w:r>${rPr}${tag.verbatim_xml}</w:r>`);
      } else {
        pushFragment(tag.verbatim_xml);
      }
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
    if (!tag) continue;

    if (tag.kind === "open") {
      stack.push({
        pair_id: tag.pair_id ?? id,
        ooxml: tag.ooxml === "run" || tag.ooxml === "hyperlink" ? tag.ooxml : "run",
        run_props: tag.run_props,
        hyperlink_rid: tag.hyperlink_rid,
        pendingChildren: tag.ooxml === "hyperlink" ? [] : undefined,
      });
    } else if (tag.kind === "close") {
      const idx = stack.findLastIndex((s) => s.pair_id === (tag.pair_id ?? id));
      if (idx === -1) continue;
      const closing = stack[idx];
      stack.splice(idx, 1);
      if (closing.ooxml === "hyperlink") {
        const ridAttr = closing.hyperlink_rid ? ` r:id="${closing.hyperlink_rid}"` : "";
        const inner = (closing.pendingChildren ?? []).join("");
        const wrapper = `<w:hyperlink${ridAttr}>${inner}</w:hyperlink>`;
        pushFragment(wrapper);
      }
    } else if (tag.kind === "empty") {
      emitEmpty(tag);
    }
  }
  if (cursor < translated.length) emitText(translated.slice(cursor));

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

function isRunLevelVerbatim(xml: string): boolean {
  return RUN_LEVEL_VERBATIM.some((tag) => xml.startsWith(`<${tag}`));
}
