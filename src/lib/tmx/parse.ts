import { XMLParser } from "fast-xml-parser";

export interface TmxUnit {
  source_text: string;
  target_text: string;
  source_lang?: string;
  target_lang?: string;
  note?: string;
  domain?: string;
  created_by_orig?: string;
  changedate?: string;
}

export interface TmxParseResult {
  source_lang: string;
  target_lang: string;
  units: TmxUnit[];
  warnings: string[];
}

interface TmxTuv {
  "@_xml:lang"?: string;
  "@_lang"?: string;
  seg?: string | { "#text"?: string };
  prop?: TmxProp | TmxProp[];
  note?: string;
}

interface TmxProp {
  "@_type"?: string;
  "#text"?: string;
}

interface TmxTu {
  tuv?: TmxTuv | TmxTuv[];
  prop?: TmxProp | TmxProp[];
  note?: string;
  "@_creationdate"?: string;
  "@_changedate"?: string;
  "@_creationid"?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  trimValues: true,
});

function getSegText(seg: TmxTuv["seg"]): string {
  if (!seg) return "";
  if (typeof seg === "string") return seg;
  // Object with mixed content — concatenate string fragments. We strip inline tags
  // but keep their text content. Future: preserve placeholder positions.
  if (typeof seg === "object") {
    const text = seg["#text"];
    if (typeof text === "string") return text;
  }
  return "";
}

function getLang(tuv: TmxTuv): string | undefined {
  return tuv["@_xml:lang"] ?? tuv["@_lang"];
}

function getProps(props: TmxProp | TmxProp[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  const arr = !props ? [] : Array.isArray(props) ? props : [props];
  for (const p of arr) {
    const k = p["@_type"];
    const v = p["#text"];
    if (k && typeof v === "string") out[k] = v;
  }
  return out;
}

/**
 * Parse TMX 1.4 buffer/string into source/target unit pairs.
 *
 * Behavior:
 *  - Reads `<header>` for declared srclang and resolves target by elimination.
 *  - For each <tu>, picks the source-lang tuv and the target-lang tuv.
 *  - Skips units that are missing either side or are empty.
 *  - Handles BCP-47 lang tag normalization (case-insensitive prefix match).
 */
export function parseTmx(input: Buffer | string, opts?: { sourceLang?: string; targetLang?: string }): TmxParseResult {
  const text = typeof input === "string" ? input : input.toString("utf8");
  const root = parser.parse(text) as Record<string, unknown>;
  const tmx = root.tmx as Record<string, unknown> | undefined;
  if (!tmx) throw new Error("Not a TMX file: missing <tmx> root.");

  const header = (tmx.header as Record<string, unknown>) ?? {};
  const srclang = String(header["@_srclang"] ?? "").trim();

  const body = tmx.body as Record<string, unknown> | undefined;
  if (!body) throw new Error("Not a TMX file: missing <body>.");

  const tusRaw = body.tu;
  const tus: TmxTu[] = !tusRaw ? [] : Array.isArray(tusRaw) ? (tusRaw as TmxTu[]) : [tusRaw as TmxTu];

  const warnings: string[] = [];

  // Detect target language: scan first 50 units for a non-source language.
  let detectedSource = (opts?.sourceLang || (srclang && srclang !== "*all*" ? srclang : "")).trim();
  let detectedTarget = (opts?.targetLang || "").trim();

  if (!detectedSource || !detectedTarget) {
    const seenLangs = new Set<string>();
    for (const tu of tus.slice(0, 50)) {
      const tuvList = !tu.tuv ? [] : Array.isArray(tu.tuv) ? tu.tuv : [tu.tuv];
      for (const tuv of tuvList) {
        const l = getLang(tuv);
        if (l) seenLangs.add(l);
      }
    }
    const langs = [...seenLangs];
    if (!detectedSource && langs.length > 0) detectedSource = langs[0];
    if (!detectedTarget) {
      const other = langs.find((l) => normalize(l) !== normalize(detectedSource));
      if (other) detectedTarget = other;
    }
  }

  if (!detectedSource || !detectedTarget) {
    throw new Error(`Could not determine source/target languages. Source: '${detectedSource}', Target: '${detectedTarget}'`);
  }

  const matchesLang = (a: string, b: string) => normalize(a) === normalize(b) || normalize(a).startsWith(normalize(b)) || normalize(b).startsWith(normalize(a));

  const units: TmxUnit[] = [];
  for (const tu of tus) {
    const tuvList = !tu.tuv ? [] : Array.isArray(tu.tuv) ? tu.tuv : [tu.tuv];
    let src: TmxTuv | undefined;
    let tgt: TmxTuv | undefined;
    for (const tuv of tuvList) {
      const l = getLang(tuv);
      if (!l) continue;
      if (!src && matchesLang(l, detectedSource)) src = tuv;
      else if (!tgt && matchesLang(l, detectedTarget)) tgt = tuv;
    }
    if (!src || !tgt) continue;
    const sText = getSegText(src.seg).trim();
    const tText = getSegText(tgt.seg).trim();
    if (!sText || !tText) continue;
    const props = getProps(tu.prop);
    units.push({
      source_text: sText,
      target_text: tText,
      source_lang: detectedSource,
      target_lang: detectedTarget,
      note: typeof tu.note === "string" ? tu.note : undefined,
      domain: props["domain"] || props["x-domain"],
      created_by_orig: tu["@_creationid"],
      changedate: tu["@_changedate"],
    });
  }

  if (units.length === 0) warnings.push("No translatable unit pairs were extracted.");

  return { source_lang: detectedSource, target_lang: detectedTarget, units, warnings };
}

function normalize(lang: string): string {
  return lang.trim().toLowerCase();
}
