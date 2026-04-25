import { XMLParser } from "fast-xml-parser";

export type XliffVersion = "1.2" | "2.0";

export interface XliffUnit {
  id: string;
  source_text: string;
  target_text?: string;
  state?: string;          // 'new' | 'translated' | 'final' | 'needs-translation' | etc.
  approved?: boolean;
}

export interface XliffParseResult {
  version: XliffVersion;
  source_lang: string;
  target_lang: string;
  units: XliffUnit[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  trimValues: false,
});

type XmlNode = Record<string, unknown>;

function asArray(v: unknown): XmlNode[] {
  if (v === undefined || v === null) return [];
  if (Array.isArray(v)) return v as XmlNode[];
  if (typeof v === "object") return [v as XmlNode];
  return [];
}

function pickText(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj["#text"] === "string") return obj["#text"];
    // Mixed-content nodes — concatenate string fragments and inline element text.
    let out = "";
    for (const [k, val] of Object.entries(obj)) {
      if (k.startsWith("@_")) continue;
      if (k === "#text" && typeof val === "string") out += val;
      else if (typeof val === "string") out += val;
    }
    return out;
  }
  return "";
}

export function parseXliff(input: Buffer | string): XliffParseResult {
  const text = typeof input === "string" ? input : input.toString("utf8");
  const root = parser.parse(text) as Record<string, unknown>;
  const xliff = root.xliff as Record<string, unknown> | undefined;
  if (!xliff) throw new Error("Not an XLIFF file: missing <xliff> root.");

  const version = String(xliff["@_version"] ?? "1.2");
  if (version.startsWith("2")) return parseV2(xliff);
  return parseV1(xliff);
}

function parseV1(xliff: XmlNode): XliffParseResult {
  const files = asArray(xliff.file);
  if (files.length === 0) throw new Error("XLIFF 1.2: no <file> element.");
  const file = files[0]!;
  const source_lang = String(file["@_source-language"] ?? "");
  const target_lang = String(file["@_target-language"] ?? "");
  if (!source_lang) throw new Error("XLIFF 1.2: missing source-language.");

  const body = file.body as XmlNode | undefined;
  if (!body) throw new Error("XLIFF 1.2: missing <body>.");

  const tus: XliffUnit[] = [];
  function walkGroups(node: XmlNode) {
    for (const g of asArray(node.group)) {
      for (const tu of asArray(g["trans-unit"])) collect(tu);
      walkGroups(g);
    }
  }
  function collect(tu: XmlNode) {
    const id = String(tu["@_id"] ?? "");
    if (!id) return;
    const src = pickText(tu.source).trim();
    if (!src) return;
    const targetRaw = tu.target;
    const tgt = targetRaw ? pickText(targetRaw).trim() : "";
    const targetState = targetRaw && typeof targetRaw === "object"
      ? String((targetRaw as XmlNode)["@_state"] ?? "")
      : "";
    const approved = String(tu["@_approved"] ?? "") === "yes";
    tus.push({ id, source_text: src, target_text: tgt || undefined, state: targetState || undefined, approved });
  }
  for (const tu of asArray(body["trans-unit"])) collect(tu);
  walkGroups(body);

  return { version: "1.2", source_lang, target_lang, units: tus };
}

function parseV2(xliff: XmlNode): XliffParseResult {
  const source_lang = String(xliff["@_srcLang"] ?? "");
  const target_lang = String(xliff["@_trgLang"] ?? "");
  if (!source_lang) throw new Error("XLIFF 2.0: missing srcLang.");

  const files = asArray(xliff.file);
  if (files.length === 0) throw new Error("XLIFF 2.0: no <file> element.");

  const tus: XliffUnit[] = [];
  function collectUnit(unit: XmlNode) {
    const id = String(unit["@_id"] ?? "");
    if (!id) return;
    const segments = asArray(unit.segment);
    if (segments.length === 0) return;
    let src = "";
    let tgt = "";
    let state: string | undefined;
    for (const s of segments) {
      src += pickText(s.source);
      const t = s.target;
      if (t) {
        tgt += pickText(t);
        const st = String(s["@_state"] ?? "");
        if (st) state = st;
      }
    }
    src = src.trim();
    if (!src) return;
    tgt = tgt.trim();
    tus.push({ id, source_text: src, target_text: tgt || undefined, state });
  }
  function walk(node: XmlNode) {
    for (const u of asArray(node.unit)) collectUnit(u);
    for (const g of asArray(node.group)) walk(g);
  }
  for (const f of files) walk(f);

  return { version: "2.0", source_lang, target_lang, units: tus };
}

/* --------------------------- Generator (export) --------------------------- */

export interface XliffExportSegment {
  id: string;          // free-form, will become trans-unit id
  source_text: string;
  target_text: string;
  state?: "new" | "translated" | "needs-translation" | "final";
  approved?: boolean;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildXliff12({
  source_lang,
  target_lang,
  original,
  segments,
}: {
  source_lang: string;
  target_lang: string;
  original: string;
  segments: XliffExportSegment[];
}): string {
  const tus = segments.map((s) => {
    const state = s.state ?? (s.target_text ? "translated" : "new");
    const approved = s.approved ? ` approved="yes"` : "";
    return `    <trans-unit id="${escapeXml(s.id)}"${approved}>
      <source>${escapeXml(s.source_text)}</source>
      <target state="${escapeXml(state)}">${escapeXml(s.target_text || "")}</target>
    </trans-unit>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="${escapeXml(original)}" source-language="${escapeXml(source_lang)}" target-language="${escapeXml(target_lang)}" datatype="plaintext">
    <body>
${tus}
    </body>
  </file>
</xliff>
`;
}
