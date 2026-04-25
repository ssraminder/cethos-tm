import sbd from "sbd";
import { createHash } from "node:crypto";

export interface Segment {
  seq: number;
  source_text: string;
  source_hash: string;
  word_count: number;
}

const SBD_OPTIONS = {
  newline_boundaries: false,
  html_boundaries: false,
  sanitize: false,
  allowed_tags: false,
  preserve_whitespace: false,
} as const;

function normalize(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
}

function hash(s: string): string {
  return createHash("sha256").update(normalize(s)).digest("hex");
}

function wordCount(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Split plain text into translation segments.
 *
 * Rules (first pass — replace with full SRX later):
 *   - Hard split on paragraph boundaries (\n{2,}).
 *   - Within a paragraph, split into sentences via SBD.
 *   - Drop empty segments and pure-whitespace segments.
 */
export function segmentText(text: string): Segment[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const segments: Segment[] = [];
  let seq = 0;
  for (const para of paragraphs) {
    const sentences = sbd.sentences(para, SBD_OPTIONS);
    if (sentences.length === 0) continue;
    for (const raw of sentences) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      seq += 1;
      segments.push({
        seq,
        source_text: trimmed,
        source_hash: hash(trimmed),
        word_count: wordCount(trimmed),
      });
    }
  }
  return segments;
}

export function totalWords(segments: Segment[]): number {
  return segments.reduce((s, x) => s + x.word_count, 0);
}
