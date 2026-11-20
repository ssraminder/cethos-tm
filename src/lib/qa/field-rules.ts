/**
 * Field checks for image jobs (ID documents read by OCR).
 *
 * These are plain rules, no model involved. They exist because OCR
 * confidence is not a safe error flag on its own: in the November 2026
 * bake-off the letter O and the digit 0 were confused at 97-99% confidence.
 *
 * Source-side checks look at what was read from the image. Target-side
 * checks compare the translation with the source and only run once a target
 * has been typed.
 */

export type FieldKind = "date" | "number" | "text";

export interface FieldCheck {
  rule: "ocr_letter_digit" | "date_invalid" | "date_mismatch" | "date_format" | "identifier_changed";
  severity: "critical" | "major" | "minor";
  message: string;
}

export interface ParsedDate {
  day: number;
  month: number;
  year: number;
}

const NUMERIC_DATE = /(?<![\d/.-])(\d{1,2})([/.-])(\d{1,2})\2(\d{4}|\d{2})(?![\d/.-])/g;
const ISO_DATE = /(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/g;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_ALT = MONTHS.map((m) => `${m}|${m.slice(0, 3)}`).join("|");
const DAY_MONTH_YEAR = new RegExp(`(?<!\\d)(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_ALT})\\.?,?\\s+(\\d{4})`, "gi");
const MONTH_DAY_YEAR = new RegExp(`(${MONTH_ALT})\\.?,?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`, "gi");

function fullYear(y: string): number {
  const n = Number(y);
  if (y.length === 4) return n;
  return n <= 49 ? 2000 + n : 1900 + n;
}

function monthIndex(name: string): number {
  const lc = name.toLowerCase();
  return MONTHS.findIndex((m) => m === lc || m.slice(0, 3) === lc) + 1;
}

/** Numeric dates in the source, read day-first (the convention outside the US). */
export function sourceDates(text: string): Array<ParsedDate & { raw: string }> {
  const out: Array<ParsedDate & { raw: string }> = [];
  for (const m of text.matchAll(NUMERIC_DATE)) {
    out.push({ raw: m[0], day: Number(m[1]), month: Number(m[3]), year: fullYear(m[4]) });
  }
  return out;
}

function isRealDate(d: ParsedDate): boolean {
  if (d.month < 1 || d.month > 12 || d.day < 1) return false;
  return d.day <= new Date(d.year, d.month, 0).getDate();
}

/**
 * Every date the target could be stating. A numeric date is ambiguous, so
 * both readings (day-first and month-first) count as candidates.
 */
export function targetDateCandidates(text: string): ParsedDate[] {
  const out: ParsedDate[] = [];
  for (const m of text.matchAll(ISO_DATE)) out.push({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) });
  for (const m of text.matchAll(DAY_MONTH_YEAR)) out.push({ day: Number(m[1]), month: monthIndex(m[2]), year: Number(m[3]) });
  for (const m of text.matchAll(MONTH_DAY_YEAR)) out.push({ month: monthIndex(m[1]), day: Number(m[2]), year: Number(m[3]) });
  for (const m of text.matchAll(NUMERIC_DATE)) {
    const a = Number(m[1]);
    const b = Number(m[3]);
    const year = fullYear(m[4]);
    out.push({ day: a, month: b, year });
    out.push({ day: b, month: a, year });
  }
  return out;
}

/**
 * Identifier-like tokens: licence numbers, national IDs, long digit runs.
 * A token qualifies when it has at least 5 characters and either mixes
 * letters with digits or is all digits. Spaces inside digit groups are
 * joined first ("000 319 084" is one identifier).
 */
export function identifiers(text: string): string[] {
  const joined = text.replace(/(?<=\d) (?=\d)/g, "");
  const out: string[] = [];
  for (const m of joined.matchAll(/[A-Za-z0-9<]{5,}/g)) {
    const tok = m[0];
    if (!/\d/.test(tok)) continue;
    if (/^\d+$/.test(tok) || /[A-Za-z<]/.test(tok)) out.push(tok);
  }
  // Numeric dates are checked as dates, not as identifiers.
  const dateDigits = new Set([...text.matchAll(NUMERIC_DATE)].map((m) => m[0].replace(/\D/g, "")));
  return out.filter((t) => !dateDigits.has(t));
}

export function fieldKind(source: string): FieldKind {
  if (sourceDates(source).length > 0) return "date";
  if (identifiers(source).length > 0) return "number";
  return "text";
}

/**
 * Places where OCR probably swapped a letter for a look-alike digit or the
 * other way round: a 0 sitting between letters ("T0F", "0SMAR") or a letter
 * O sitting between digits ("9O0214").
 */
export function letterDigitSuspects(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/[A-Za-z0-9<]{4,}/g)) {
    const tok = m[0];
    if (!/\d/.test(tok) || !/[A-Za-z]/.test(tok)) continue;
    const zeroAmongLetters = /(?:^|[A-Z<])0(?=[A-Z])/.test(tok) || /(?<=[A-Z])0(?=[A-Z<]|$)/.test(tok);
    const oAmongDigits = /(?<=\d)[Oo](?=\d)/.test(tok);
    if (zeroAmongLetters || oAmongDigits) out.add(tok);
  }
  return [...out];
}

/**
 * The date format used on every Cethos certified translation into English:
 * month in words, day, comma, four-digit year ("August 12, 1964").
 */
export function houseDate(d: ParsedDate): string {
  const month = MONTHS[d.month - 1]?.replace(/^./, (c) => c.toUpperCase()) ?? `month ${d.month}`;
  return `${month} ${d.day}, ${d.year}`;
}

/** The valid dates of a source field, each written in the house format. */
export function houseDates(source: string): string[] {
  return sourceDates(source).filter(isRealDate).map(houseDate);
}

function fmt(d: ParsedDate): string {
  return houseDate(d);
}

export interface FieldCheckOptions {
  /** Target language code of the job. The house date format applies to English. */
  targetLang?: string | null;
}

/** Checks on what was read from the image. Run whether or not a target exists. */
export function sourceChecks(source: string): FieldCheck[] {
  const checks: FieldCheck[] = [];
  for (const tok of letterDigitSuspects(source)) {
    checks.push({
      rule: "ocr_letter_digit",
      severity: "major",
      message: `"${tok}" may have a letter O and a digit 0 mixed up. Compare it with the image, character by character.`,
    });
  }
  for (const d of sourceDates(source)) {
    if (!isRealDate(d)) {
      checks.push({
        rule: "date_invalid",
        severity: "major",
        message: `"${d.raw}" is not a valid date when read as day/month/year. Check the reading against the image.`,
      });
    }
  }
  return checks;
}

/** Checks that compare a typed translation with its source. */
export function targetChecks(source: string, target: string, opts: FieldCheckOptions = {}): FieldCheck[] {
  const tgt = target.trim();
  if (!tgt) return [];
  const checks: FieldCheck[] = [];
  const english = (opts.targetLang ?? "").toLowerCase().startsWith("en");
  const tgtFlat = tgt.replace(/\s+/g, " ").toLowerCase();

  const candidates = targetDateCandidates(tgt);
  for (const d of sourceDates(source)) {
    if (!isRealDate(d)) continue;
    const found = candidates.some((c) => c.day === d.day && c.month === d.month && c.year === d.year);
    if (!found) {
      checks.push({
        rule: "date_mismatch",
        severity: "critical",
        message: `The source date ${d.raw} (${fmt(d)}) does not appear in the translation.`,
      });
    } else if (english && !tgtFlat.includes(houseDate(d).toLowerCase())) {
      // The date is there, but not written the way certified translations write it.
      checks.push({
        rule: "date_format",
        severity: "major",
        message: `Write the date ${d.raw} as ${houseDate(d)}. Certified translations give every date as month in words, day, four-digit year.`,
      });
    }
  }

  const tgtCompact = tgt.replace(/\s+/g, "").toUpperCase();
  for (const id of identifiers(source)) {
    if (!tgtCompact.includes(id.toUpperCase())) {
      checks.push({
        rule: "identifier_changed",
        severity: "critical",
        message: `"${id}" does not appear unchanged in the translation. Numbers and identifiers must be copied exactly; if the reading itself is wrong, correct the source reading.`,
      });
    }
  }
  return checks;
}

export function fieldChecks(source: string, target: string, opts: FieldCheckOptions = {}): FieldCheck[] {
  return [...sourceChecks(source), ...targetChecks(source, target, opts)];
}
