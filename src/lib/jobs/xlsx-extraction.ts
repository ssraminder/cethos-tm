/**
 * XLSX extraction + export. Mirrors the DOCX OOXML round-trip for
 * spreadsheets.
 *
 * Extraction walks xl/sharedStrings.xml in <si> order, then every sheet
 * for inline strings. Each translatable string becomes one segment.
 *
 * Export downloads the original .xlsx, splices translated text back into
 * the matching <si>/<is> bodies, repackages.
 */

import JSZip from "jszip";
import {
  extractSharedStrings,
  extractInlineStrings,
  rebuildStringInner,
  spliceSharedStrings,
  spliceInlineStrings,
  type XlsxStringSegment,
  type OoxmlTag,
} from "./xlsx-tags";

export interface XlsxExtractedParagraph {
  /** Carried into segments.meta.tags + meta.location for export. */
  plain_text: string;
  tags: OoxmlTag[];
  location: XlsxStringSegment["location"];
}

export async function extractXlsxBuffer(buffer: Buffer): Promise<XlsxExtractedParagraph[]> {
  const zip = await JSZip.loadAsync(buffer);

  const all: XlsxStringSegment[] = [];
  let nextSeq = 1;

  // 1. Shared strings.
  const sharedFile = zip.file("xl/sharedStrings.xml");
  if (sharedFile) {
    const xml = await sharedFile.async("string");
    const r = extractSharedStrings(xml, nextSeq);
    all.push(...r.segments);
    nextSeq = r.nextSeq;
  }

  // 2. Inline strings, one sheet at a time.
  const sheetFiles = Object.keys(zip.files).filter(
    (n) => n.startsWith("xl/worksheets/") && n.endsWith(".xml"),
  );
  sheetFiles.sort(); // sheet1.xml, sheet2.xml, …
  for (const name of sheetFiles) {
    const xml = await zip.file(name)!.async("string");
    const sheetName = name.replace("xl/worksheets/", "").replace(".xml", "");
    const r = extractInlineStrings(xml, sheetName, nextSeq);
    all.push(...r.segments);
    nextSeq = r.nextSeq;
  }

  // Drop empty-text segments — they're noise and don't need translation.
  return all
    .filter((s) => s.plain_text.trim().length > 0)
    .map((s) => ({
      plain_text: s.plain_text,
      tags: s.tags,
      location: s.location,
    }));
}

/**
 * Round-trip: take the original XLSX buffer + a list of translated segments
 * carrying their original locations, return a new XLSX buffer.
 */
export async function exportXlsxBuffer(
  sourceBuffer: Buffer,
  translatedSegments: Array<{
    target_text: string;
    source_text: string;
    tags: OoxmlTag[];
    location: XlsxStringSegment["location"];
  }>,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(sourceBuffer);

  // Group translations by destination.
  const sharedReplacements = new Map<number, string>();
  const inlineReplacementsBySheet = new Map<string, Map<string, string>>();

  for (const seg of translatedSegments) {
    const text = seg.target_text.trim().length > 0 ? seg.target_text : seg.source_text;
    const newInner = rebuildStringInner(text, seg.tags);
    if (seg.location.kind === "shared") {
      sharedReplacements.set(seg.location.index, newInner);
    } else {
      const m = inlineReplacementsBySheet.get(seg.location.sheet) ?? new Map<string, string>();
      m.set(seg.location.cell, newInner);
      inlineReplacementsBySheet.set(seg.location.sheet, m);
    }
  }

  // Splice shared strings.
  if (sharedReplacements.size > 0) {
    const file = zip.file("xl/sharedStrings.xml");
    if (file) {
      const xml = await file.async("string");
      zip.file("xl/sharedStrings.xml", spliceSharedStrings(xml, sharedReplacements));
    }
  }

  // Splice inline strings per sheet.
  for (const [sheetName, replacements] of inlineReplacementsBySheet.entries()) {
    const path = `xl/worksheets/${sheetName}.xml`;
    const file = zip.file(path);
    if (!file) continue;
    const xml = await file.async("string");
    zip.file(path, spliceInlineStrings(xml, replacements));
  }

  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}
