/**
 * PPTX extraction + export orchestrator.
 *
 * Walks every translatable XML file in a .pptx (slides + notes) and
 * collects one segment per <a:p>. Each segment carries its file path +
 * paragraph index so the export pipeline can splice back into the right
 * spot.
 *
 * Files we walk:
 *   ppt/slides/slide*.xml          — slide content (titles, bullets, body)
 *   ppt/notesSlides/notesSlide*.xml — speaker notes
 *
 * Files we skip:
 *   ppt/slideLayouts/, ppt/slideMasters/  — placeholder template text
 *     (most users don't translate these; "Click to add title" should not
 *     appear in segments). Add to the walk list later if needed.
 *   ppt/charts/                          — chart titles/labels (often
 *     bound to data; out of scope V1).
 *   ppt/diagrams/                        — diagram text (rare).
 */

import JSZip from "jszip";
import {
  extractPptxParagraphs,
  splicePptxParagraphs,
  type PptxParagraphSegment,
} from "./pptx-tags";
import type { OoxmlTag } from "./ooxml-tags";

export interface PptxExtractedParagraph {
  plain_text: string;
  tags: OoxmlTag[];
  /** Where this paragraph lives in the .pptx zip — used by export. */
  location: { file: string; para: number };
}

export async function extractPptxBuffer(
  buffer: Buffer,
): Promise<PptxExtractedParagraph[]> {
  const zip = await JSZip.loadAsync(buffer);

  const out: PptxParagraphSegment[] = [];
  const filePaths = Object.keys(zip.files).filter(
    (n) =>
      (n.startsWith("ppt/slides/slide") && n.endsWith(".xml")) ||
      (n.startsWith("ppt/notesSlides/notesSlide") && n.endsWith(".xml")),
  );

  // Sort numerically so slide2 < slide10 (string sort would put slide10
  // before slide2).
  filePaths.sort((a, b) => {
    const na = parseInt(a.match(/(\d+)\.xml$/)?.[1] ?? "0", 10);
    const nb = parseInt(b.match(/(\d+)\.xml$/)?.[1] ?? "0", 10);
    if (a.replace(/\d+\.xml$/, "") !== b.replace(/\d+\.xml$/, "")) {
      // Slides before notes
      return a < b ? -1 : 1;
    }
    return na - nb;
  });

  for (const path of filePaths) {
    const xml = await zip.file(path)!.async("string");
    out.push(...extractPptxParagraphs(xml, path));
  }

  return out
    .filter((s) => s.plain_text.replace(/\{\d+\}/g, "").trim().length > 0)
    .map((s) => ({
      plain_text: s.plain_text,
      tags: s.tags,
      location: { file: s.file_path, para: s.para_index },
    }));
}

export async function exportPptxBuffer(
  sourceBuffer: Buffer,
  translatedSegments: Array<{
    target_text: string;
    source_text: string;
    tags: OoxmlTag[];
    location: { file: string; para: number };
  }>,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(sourceBuffer);

  // Group replacements by file.
  const byFile = new Map<string, Map<number, { translated: string; tags: OoxmlTag[] }>>();
  for (const seg of translatedSegments) {
    const text = seg.target_text.trim().length > 0 ? seg.target_text : seg.source_text;
    const m = byFile.get(seg.location.file) ?? new Map();
    m.set(seg.location.para, { translated: text, tags: seg.tags });
    byFile.set(seg.location.file, m);
  }

  for (const [filePath, replacements] of byFile.entries()) {
    const file = zip.file(filePath);
    if (!file) continue;
    const xml = await file.async("string");
    zip.file(filePath, splicePptxParagraphs(xml, replacements));
  }

  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}
