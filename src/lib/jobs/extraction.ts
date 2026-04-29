import mammoth from "mammoth";
import {
  extractInlineTags,
  splitHtmlIntoParagraphs,
  type ParagraphSegment,
} from "./inline-tags";

export type SupportedFormat = "txt" | "md" | "html" | "docx" | "json" | "xliff" | "unknown";

export function detectFormat(filename: string, mimeType: string | undefined): SupportedFormat {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".txt")) return "txt";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".xliff") || lower.endsWith(".xlf")) return "xliff";
  if (mimeType?.includes("wordprocessingml")) return "docx";
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
