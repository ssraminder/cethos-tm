import { extractInlineTags, type InlineTag } from "./tags";
import type { XliffUnit, XliffParseResult } from "./parse";

/**
 * Parse an SDLXLIFF file (SDL Trados variant of XLIFF 1.2).
 *
 * Key differences from plain XLIFF 1.2:
 *  - Source and target text are sub-segmented with <mrk mtype="seg" mid="N">
 *    markers. Each mrk becomes one translatable unit.
 *  - Segment confirmation status lives in <sdl:seg-defs> → <sdl:seg id="N"
 *    conf="..."> rather than the standard <target state="...">.
 *  - Locked segments are wrapped in <mrk mtype="x-sdl-locked">.
 *  - SDL namespace elements (sdl:cmt, sdl:cmt-defs, sdl:value, etc.) should
 *    be stripped from translatable text but preserved as inline tags.
 */

const SDL_CONF_MAP: Record<string, { state: string; approved: boolean }> = {
  Translated: { state: "translated", approved: false },
  ApprovedTranslation: { state: "translated", approved: true },
  ApprovedSignOff: { state: "final", approved: true },
  Draft: { state: "needs-translation", approved: false },
  RejectedTranslation: { state: "needs-translation", approved: false },
  RejectedSignOff: { state: "needs-translation", approved: false },
  Unspecified: { state: "new", approved: false },
};

interface SdlSegDef {
  conf?: string;
  locked?: boolean;
}

function parseSegDefs(tuBlock: string): Map<string, SdlSegDef> {
  const defs = new Map<string, SdlSegDef>();
  const defsBlockMatch = tuBlock.match(/<sdl:seg-defs\b[^>]*>([\s\S]*?)<\/sdl:seg-defs>/i);
  if (!defsBlockMatch) return defs;
  const segs = defsBlockMatch[1];
  const re = /<sdl:seg\b([^>]*?)\/?\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(segs)) !== null) {
    const attrs = m[1];
    const idMatch = attrs.match(/\bid\s*=\s*["']([^"']+)["']/i);
    const confMatch = attrs.match(/\bconf\s*=\s*["']([^"']+)["']/i);
    const lockedMatch = attrs.match(/\blocked\s*=\s*["']true["']/i);
    if (idMatch) {
      defs.set(idMatch[1], {
        conf: confMatch?.[1],
        locked: !!lockedMatch,
      });
    }
  }
  return defs;
}

interface MrkSegment {
  mid: string;
  innerXml: string;
}

function extractMrkSegments(elementInnerXml: string): MrkSegment[] {
  const segments: MrkSegment[] = [];
  const re = /<mrk\b[^>]*\bmtype\s*=\s*["']seg["'][^>]*\bmid\s*=\s*["'](\d+)["'][^>]*>([\s\S]*?)<\/mrk>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(elementInnerXml)) !== null) {
    segments.push({ mid: m[1], innerXml: m[2] });
  }
  // Also try the reversed attribute order: mid before mtype
  if (segments.length === 0) {
    const re2 = /<mrk\b[^>]*\bmid\s*=\s*["'](\d+)["'][^>]*\bmtype\s*=\s*["']seg["'][^>]*>([\s\S]*?)<\/mrk>/gi;
    while ((m = re2.exec(elementInnerXml)) !== null) {
      segments.push({ mid: m[1], innerXml: m[2] });
    }
  }
  return segments;
}

function stripLockedMarkers(xml: string): string {
  return xml
    .replace(/<mrk\b[^>]*\bmtype\s*=\s*["']x-sdl-locked["'][^>]*>/gi, "")
    .replace(/<\/mrk>/gi, "");
}

function findInnerXml(block: string, tagName: string): string | null {
  const re = new RegExp(`<${tagName}\\b[^>]*?>([\\s\\S]*?)</${tagName}>`, "i");
  const m = block.match(re);
  return m ? m[1] : null;
}

export function parseSdlXliff(input: Buffer | string): XliffParseResult {
  const text = typeof input === "string" ? input : input.toString("utf8");

  // Verify it's an XLIFF file
  if (!/<xliff\b/i.test(text)) {
    throw new Error("Not an SDLXLIFF file: missing <xliff> root.");
  }

  // Extract source/target languages from <file>
  const fileMatch = text.match(/<file\b([^>]*)>/i);
  if (!fileMatch) throw new Error("SDLXLIFF: no <file> element.");
  const fileAttrs = fileMatch[1];
  const srcLangMatch = fileAttrs.match(/\bsource-language\s*=\s*["']([^"']+)["']/i);
  const tgtLangMatch = fileAttrs.match(/\btarget-language\s*=\s*["']([^"']+)["']/i);
  if (!srcLangMatch) throw new Error("SDLXLIFF: missing source-language.");
  const source_lang = srcLangMatch[1];
  const target_lang = tgtLangMatch ? tgtLangMatch[1] : "";

  const units: XliffUnit[] = [];

  // Iterate <trans-unit> blocks
  const tuRe = /<trans-unit\b([^>]*)>([\s\S]*?)<\/trans-unit>/g;
  let tuMatch: RegExpExecArray | null;
  while ((tuMatch = tuRe.exec(text)) !== null) {
    const tuAttrs = tuMatch[1];
    const tuBlock = tuMatch[2];
    const tuIdMatch = tuAttrs.match(/\bid\s*=\s*["']([^"']+)["']/i);
    const tuId = tuIdMatch ? tuIdMatch[1] : "";
    if (!tuId) continue;

    // Check if translate="no"
    const translateMatch = tuAttrs.match(/\btranslate\s*=\s*["']no["']/i);
    if (translateMatch) continue;

    const segDefs = parseSegDefs(tuBlock);
    const sourceInner = findInnerXml(tuBlock, "source");
    const targetInner = findInnerXml(tuBlock, "target");
    if (!sourceInner) continue;

    // Check for <mrk mtype="seg"> sub-segmentation
    const sourceSegs = extractMrkSegments(sourceInner);
    const targetSegs = targetInner ? extractMrkSegments(targetInner) : [];
    const targetByMid = new Map(targetSegs.map((s) => [s.mid, s.innerXml]));

    if (sourceSegs.length > 0) {
      // SDL sub-segmented: each mrk segment becomes its own unit
      for (const seg of sourceSegs) {
        const segId = `${tuId}_${seg.mid}`;
        const cleanedSource = stripLockedMarkers(seg.innerXml);
        const srcExtracted = extractInlineTags(cleanedSource);
        const src = srcExtracted.plain_text.trim();
        if (!src) continue;

        const def = segDefs.get(seg.mid);
        if (def?.locked) continue;

        let target_text: string | undefined;
        let target_tags: InlineTag[] | undefined;
        const tgtInner = targetByMid.get(seg.mid);
        if (tgtInner) {
          const cleanedTarget = stripLockedMarkers(tgtInner);
          const tgtExtracted = extractInlineTags(cleanedTarget);
          const tgt = tgtExtracted.plain_text.trim();
          target_text = tgt || undefined;
          target_tags = tgtExtracted.tags.length > 0 ? tgtExtracted.tags : undefined;
        }

        const confInfo = def?.conf ? SDL_CONF_MAP[def.conf] : undefined;
        units.push({
          id: segId,
          source_text: src,
          target_text,
          state: confInfo?.state ?? "new",
          approved: confInfo?.approved ?? false,
          source_tags: srcExtracted.tags.length > 0 ? srcExtracted.tags : undefined,
          target_tags,
        });
      }
    } else {
      // No sub-segmentation — treat entire source/target as one unit (like plain XLIFF)
      const srcExtracted = extractInlineTags(sourceInner);
      const src = srcExtracted.plain_text.trim();
      if (!src) continue;

      let target_text: string | undefined;
      let target_tags: InlineTag[] | undefined;
      let state: string | undefined;
      let approved = false;
      if (targetInner !== null) {
        const tgtExtracted = extractInlineTags(targetInner);
        target_text = tgtExtracted.plain_text.trim() || undefined;
        target_tags = tgtExtracted.tags.length > 0 ? tgtExtracted.tags : undefined;
        const stateMatch = tuBlock.match(/<target\b[^>]*\bstate\s*=\s*["']([^"']+)["']/i);
        state = stateMatch ? stateMatch[1] : undefined;
      }
      const tuApproved = tuAttrs.match(/\bapproved\s*=\s*["']yes["']/i);
      if (tuApproved) approved = true;

      units.push({
        id: tuId,
        source_text: src,
        target_text,
        state,
        approved,
        source_tags: srcExtracted.tags.length > 0 ? srcExtracted.tags : undefined,
        target_tags,
      });
    }
  }

  return { version: "1.2", source_lang, target_lang, units };
}
