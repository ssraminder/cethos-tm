import mammoth from "mammoth";
import JSZip from "jszip";
import {
  extractInlineTags,
  splitHtmlIntoParagraphs,
  type ParagraphSegment,
} from "./inline-tags";
import {
  extractOoxmlParagraphs,
  type OoxmlParagraphSegment,
} from "./ooxml-tags";

export type SupportedFormat = "txt" | "md" | "html" | "docx" | "xlsx" | "json" | "xliff" | "unknown";

export function detectFormat(filename: string, mimeType: string | undefined): SupportedFormat {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".txt")) return "txt";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".xliff") || lower.endsWith(".xlf")) return "xliff";
  if (mimeType?.includes("wordprocessingml")) return "docx";
  if (mimeType?.includes("spreadsheetml")) return "xlsx";
  if (mimeType === "text/plain") return "txt";
  if (mimeType === "text/html") return "html";
  return "unknown";
}

/**
 * Extract plain text from a source file. Returns text with paragraph boundaries
 * preserved as double newlines so the segmenter can hint on them.
 */
export async function extractText(buffer: Buffer, format: SupportedFormat): Promise<string> {
  switch (format) {
    case "txt":
    case "md":
      return buffer.toString("utf8");

    case "docx": {
      const { value } = await mammoth.extractRawText({ buffer });
      return value;
    }

    case "html": {
      // Cheap strip — good enough for first pass; reuse a real HTML parser later.
      const txt = buffer
        .toString("utf8")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "$&\n\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"');
      return txt;
    }

    case "json": {
      // Flatten nested string values into one text per line.
      const data = JSON.parse(buffer.toString("utf8"));
      const lines: string[] = [];
      const walk = (v: unknown) => {
        if (typeof v === "string") lines.push(v);
        else if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === "object") Object.values(v).forEach(walk);
      };
      walk(data);
      return lines.join("\n\n");
    }

    case "xliff":
      // XLIFF is bilingual — caller must use parseXliff() instead of going
      // through the plain-text segmenter. Reaching this branch is a bug.
      throw new Error("XLIFF should be ingested via parseXliff(), not extractText().");

    case "unknown":
    default:
      throw new Error(`Format '${format}' not yet supported for extraction.`);
  }
}

/**
 * Tag-preserving extraction for DOCX and HTML. Each paragraph (or table
 * cell, list item, heading) becomes one ParagraphSegment with plain text
 * containing {N} placeholders for any inline formatting + a tag inventory.
 *
 * For TXT/MD/JSON we don't have formatting to preserve — fall back to plain
 * text and split on blank lines so each paragraph is one segment.
 */
export async function extractParagraphsWithTags(
  buffer: Buffer,
  format: SupportedFormat,
): Promise<ParagraphSegment[]> {
  switch (format) {
    case "docx": {
      // V2: walk OOXML directly so run-level formatting (bold/italic/
      // hyperlink/br/tab) survives the round-trip back to .docx. Falls back
      // to mammoth-HTML if the OOXML walker yields nothing (rare).
      const ooxml = await extractDocxAsOoxml(buffer);
      if (ooxml.length > 0) {
        return ooxml.map((p) => ({
          plain_text: p.plain_text,
          // Cast: the existing ParagraphSegment.tags shape (with original_xml)
          // and OoxmlTag both end up serialized into segments.meta.tags. The
          // export path discriminates by reading meta.format/tag shape.
          tags: p.tags as unknown as ParagraphSegment["tags"],
        }));
      }
      const { value: html } = await mammoth.convertToHtml({ buffer });
      return splitHtmlIntoParagraphs(html).map(extractInlineTags);
    }

    case "html": {
      const html = buffer.toString("utf8");
      return splitHtmlIntoParagraphs(html).map(extractInlineTags);
    }

    case "txt":
    case "md":
    case "json": {
      const plain = await extractText(buffer, format);
      return plain
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => ({ plain_text: p, tags: [] }));
    }

    case "xliff":
      throw new Error("XLIFF should be ingested via parseXliff(), not extractParagraphsWithTags().");

    case "unknown":
    default:
      throw new Error(`Format '${format}' not yet supported for tagged extraction.`);
  }
}

/**
 * DOCX-specific OOXML extraction. Reads word/document.xml from the .docx
 * zip and walks paragraphs directly, preserving run-level formatting and
 * hyperlink wrappers as {N} placeholders + tag inventory.
 */
export async function extractDocxAsOoxml(
  buffer: Buffer,
): Promise<OoxmlParagraphSegment[]> {
  const zip = await JSZip.loadAsync(buffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) return [];
  const xml = await docFile.async("string");
  return extractOoxmlParagraphs(xml);
}
