import { XMLParser } from "fast-xml-parser";

export interface TbxTerm {
  language: string;
  term: string;
  part_of_speech?: string;
  status?: "approved" | "pending" | "forbidden";
  usage_example?: string;
}

export interface TbxConcept {
  domain?: string;
  definition?: string;
  terms: TbxTerm[];
}

export interface TbxParseResult {
  languages: string[];
  concepts: TbxConcept[];
  warnings: string[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  trimValues: true,
});

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function pickText(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "#text" in (v as Record<string, unknown>)) {
    const t = (v as Record<string, unknown>)["#text"];
    if (typeof t === "string") return t;
  }
  return "";
}

function getDescrips(node: unknown): Record<string, string> {
  // descrip elements: <descrip type="domain">marketing</descrip>
  const out: Record<string, string> = {};
  if (!node || typeof node !== "object") return out;
  const obj = node as Record<string, unknown>;
  const descrip = asArray(obj["descrip"]);
  for (const d of descrip) {
    if (!d || typeof d !== "object") continue;
    const dr = d as Record<string, unknown>;
    const type = String(dr["@_type"] ?? "");
    const text = pickText(dr);
    if (type) out[type] = text;
  }
  // termNote / descripGrp also possible — flatten
  const termNote = asArray(obj["termNote"]);
  for (const t of termNote) {
    if (!t || typeof t !== "object") continue;
    const tr = t as Record<string, unknown>;
    const type = String(tr["@_type"] ?? "");
    const text = pickText(tr);
    if (type) out[type] = text;
  }
  return out;
}

function statusFromAdmin(node: unknown): "approved" | "pending" | "forbidden" | undefined {
  if (!node || typeof node !== "object") return undefined;
  const obj = node as Record<string, unknown>;
  const admin = asArray(obj["admin"]);
  for (const a of admin) {
    if (!a || typeof a !== "object") continue;
    const ar = a as Record<string, unknown>;
    const type = String(ar["@_type"] ?? "");
    const text = pickText(ar).toLowerCase();
    if (type === "termType" || type === "administrativeStatus") {
      if (text.includes("forbid") || text.includes("deprecat")) return "forbidden";
      if (text.includes("preferr") || text.includes("approv") || text.includes("standard")) return "approved";
    }
  }
  return undefined;
}

/**
 * Parse TBX (TBX-Basic / TBX 2.0 / TBX 3.0). Returns concept entries with
 * their language-tagged terms.
 */
export function parseTbx(input: Buffer | string): TbxParseResult {
  const text = typeof input === "string" ? input : input.toString("utf8");
  const root = parser.parse(text) as Record<string, unknown>;

  // TBX 2.0/Basic: <martif> root, body has <termEntry>
  // TBX 3.0: <tbx> root, body has <conceptEntry>
  let body: Record<string, unknown> | undefined;
  let entryKey = "termEntry";

  if (root.martif && typeof root.martif === "object") {
    const martif = root.martif as Record<string, unknown>;
    const t = (martif.text as Record<string, unknown> | undefined) ?? martif;
    body = (t.body as Record<string, unknown> | undefined) ?? (martif.body as Record<string, unknown> | undefined);
    entryKey = "termEntry";
  } else if (root.tbx && typeof root.tbx === "object") {
    const tbx = root.tbx as Record<string, unknown>;
    const t = (tbx.text as Record<string, unknown> | undefined) ?? tbx;
    body = (t.body as Record<string, unknown> | undefined) ?? (tbx.body as Record<string, unknown> | undefined);
    entryKey = "conceptEntry";
  }
  if (!body) throw new Error("Not a TBX file: no <body> under <martif>/<tbx>.");

  const entries = asArray(body[entryKey]);
  const langSet = new Set<string>();
  const concepts: TbxConcept[] = [];
  const warnings: string[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const er = entry as Record<string, unknown>;
    const descrips = getDescrips(er);
    const concept: TbxConcept = {
      domain: descrips["domain"] || descrips["subjectField"],
      definition: descrips["definition"],
      terms: [],
    };

    const langSets = asArray((er.langSet ?? er.langSec) as unknown);
    for (const ls of langSets) {
      if (!ls || typeof ls !== "object") continue;
      const lr = ls as Record<string, unknown>;
      const lang = String(lr["@_xml:lang"] ?? lr["@_lang"] ?? "").trim();
      if (!lang) continue;
      langSet.add(lang);

      // <tig> in TBX-Basic, <termSec> in TBX 3.0, may have multiple terms.
      const tigs = [
        ...asArray(lr.tig),
        ...asArray(lr.termSec),
        ...asArray(lr.ntig),
      ];
      // Sometimes <term> sits directly in langSet
      if (tigs.length === 0 && lr.term) tigs.push(lr);

      for (const tig of tigs) {
        if (!tig || typeof tig !== "object") continue;
        const tr = tig as Record<string, unknown>;
        const term = pickText(tr.term).trim();
        if (!term) continue;
        const tdescrips = getDescrips(tr);
        const status = statusFromAdmin(tr);
        concept.terms.push({
          language: lang,
          term,
          part_of_speech: tdescrips["partOfSpeech"],
          usage_example: tdescrips["context"] || tdescrips["example"],
          status,
        });
      }
    }
    if (concept.terms.length > 0) concepts.push(concept);
  }

  if (concepts.length === 0) warnings.push("No concept entries with terms were found.");
  return { languages: [...langSet], concepts, warnings };
}
