import JSZip from "jszip";
import { parseSdlXliff } from "./sdlxliff";
import type { XliffUnit, XliffParseResult } from "./parse";

export interface SdlPackageFile {
  path: string;
  buffer: Buffer;
}

export interface SdlPackageParseResult {
  source_lang: string;
  target_lang: string;
  files: Array<{
    filename: string;
    path: string;
    units: XliffUnit[];
  }>;
  all_units: XliffUnit[];
  project_name?: string;
}

function extractProjectName(sdlprojXml: string): string | undefined {
  const m = sdlprojXml.match(/<Name>([^<]+)<\/Name>/i);
  return m ? m[1].trim() : undefined;
}

function extractProjectLanguages(sdlprojXml: string): { source?: string; target?: string } {
  const srcMatch = sdlprojXml.match(/<SourceLanguageCode>([^<]+)<\/SourceLanguageCode>/i);
  const tgtMatch = sdlprojXml.match(/<TargetLanguageCode>([^<]+)<\/TargetLanguageCode>/i);
  // Also try the Language element with CultureName attribute pattern
  const langPairSrc = sdlprojXml.match(/<SourceLanguage\b[^>]*\bCultureName\s*=\s*["']([^"']+)["']/i);
  const langPairTgt = sdlprojXml.match(/<TargetLanguage\b[^>]*\bCultureName\s*=\s*["']([^"']+)["']/i);
  return {
    source: srcMatch?.[1] ?? langPairSrc?.[1],
    target: tgtMatch?.[1] ?? langPairTgt?.[1],
  };
}

/**
 * Parse an SDL project package (.sdlppx) or return package (.sdlrpx).
 *
 * These are ZIP archives containing:
 *  - *.sdlproj — project settings XML
 *  - *.sdlxliff — bilingual files (one per source document per target language)
 *  - Optionally: *.sdltm, *.sdltb (TM/termbase — not imported here)
 *
 * Returns all translatable units from all SDLXLIFF files in the package,
 * with per-file grouping so callers can create one job per file or one
 * combined job.
 */
export async function parseSdlPackage(input: Buffer): Promise<SdlPackageParseResult> {
  const zip = await JSZip.loadAsync(input);

  // Find the .sdlproj file for metadata
  let projectName: string | undefined;
  let projSourceLang: string | undefined;
  let projTargetLang: string | undefined;

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (path.toLowerCase().endsWith(".sdlproj")) {
      const xml = await entry.async("string");
      projectName = extractProjectName(xml);
      const langs = extractProjectLanguages(xml);
      projSourceLang = langs.source;
      projTargetLang = langs.target;
      break;
    }
  }

  // Find all .sdlxliff files
  const sdlxliffEntries: Array<{ path: string; entry: JSZip.JSZipObject }> = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (path.toLowerCase().endsWith(".sdlxliff")) {
      sdlxliffEntries.push({ path, entry });
    }
  }

  if (sdlxliffEntries.length === 0) {
    throw new Error("SDL package contains no .sdlxliff files.");
  }

  const files: SdlPackageParseResult["files"] = [];
  let source_lang = projSourceLang ?? "";
  let target_lang = projTargetLang ?? "";

  for (const { path, entry } of sdlxliffEntries) {
    const buf = Buffer.from(await entry.async("arraybuffer"));
    let parsed: XliffParseResult;
    try {
      parsed = parseSdlXliff(buf);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[parseSdlPackage] Skipping ${path}: ${msg}`);
      continue;
    }

    if (!source_lang && parsed.source_lang) source_lang = parsed.source_lang;
    if (!target_lang && parsed.target_lang) target_lang = parsed.target_lang;

    const filename = path.split("/").pop() ?? path;
    files.push({
      filename,
      path,
      units: parsed.units,
    });
  }

  if (files.length === 0) {
    throw new Error("No translatable content found in SDL package.");
  }

  const all_units = files.flatMap((f) => f.units);
  if (all_units.length === 0) {
    throw new Error("SDL package files contained no translatable segments.");
  }

  return {
    source_lang,
    target_lang,
    files,
    all_units,
    project_name: projectName,
  };
}
