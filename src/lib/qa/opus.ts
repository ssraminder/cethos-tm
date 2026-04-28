/**
 * Opus QA pass — batched, prompt-cached.
 *
 * For each batch of segments we send one request to Claude Opus with:
 *   - cached system block: language pair, glossary, style guide,
 *     punctuation rules, severity rubric, JSON schema
 *   - per-batch user block: list of segments (id, source, target,
 *     prior_findings_summary)
 *
 * Returns findings ready to be inserted into qa_findings (run_id, source,
 * category, severity, message, suggested_target).
 */

import Anthropic from "@anthropic-ai/sdk";
import type { QaFinding, QaSeverity } from "./rules";

const MODEL = "claude-opus-4-7";
const BATCH_SIZE = 50;
const MAX_OUTPUT_TOKENS = 4000;

export interface OpusBatchInput {
  id: string;
  source: string;
  target: string;
  prior_findings_summary?: string;
}

export interface OpusFinding {
  segment_id: string;
  severity: "info" | "warn" | "error";
  category: string;
  message: string;
  suggested_target?: string;
}

export interface OpusUsage {
  input_tokens: number;
  cached_tokens: number;
  output_tokens: number;
}

export interface OpusBatchResult {
  findings: OpusFinding[];
  usage: OpusUsage;
}

/**
 * Per-target-language punctuation guidance baked into the system prompt.
 * Keep this terse — it lives in the cached block.
 */
const PUNCTUATION_RULES: Record<string, string> = {
  fr: "French: NBSP (U+00A0) before ; : ? ! and inside « ». Decimal separator is ,",
  zh: "Chinese: full-width punctuation 。！？，：； — never ASCII period at sentence end.",
  ja: "Japanese: full-width 。！？、 — no spaces, no ASCII terminal punctuation.",
  ko: "Korean: ASCII punctuation OK; spaces between clauses respected.",
  th: "Thai: NO terminal period for sentences. Spaces separate clauses.",
  lo: "Lao: NO terminal period; spaces separate clauses.",
  km: "Khmer: terminal mark ។ (U+17D4); no Latin period.",
  my: "Burmese: terminal mark ။ (U+104B); no Latin period.",
  ar: "Arabic: ، (U+060C) for comma, ؛ (U+061B) for semicolon, ؟ (U+061F) for question. Right-to-left.",
  he: "Hebrew: standard ASCII punctuation but right-to-left flow.",
  el: "Greek: ; (U+003B) is the question mark; · (U+0387) is ano teleia.",
  es: "Spanish: opening ¡ ¿ for exclamation/question.",
  de: "German: standard ASCII punctuation; nouns capitalized.",
};

function languageHint(targetLang: string): string {
  const code = targetLang.toLowerCase().slice(0, 2);
  return PUNCTUATION_RULES[code] ?? "Use standard punctuation conventions for the target language.";
}

function buildSystemPrompt(args: {
  sourceLang: string;
  targetLang: string;
  glossary: Array<{ source: string; target: string; notes?: string; status?: string }>;
  styleGuide?: string | null;
}): Anthropic.Messages.TextBlockParam[] {
  const { sourceLang, targetLang, glossary, styleGuide } = args;

  const glossaryBlock = glossary.length === 0
    ? "(no glossary attached)"
    : glossary
        .map((g) => `- ${g.source} → ${g.target}${g.status === "forbidden" ? " [FORBIDDEN]" : ""}${g.notes ? ` — ${g.notes}` : ""}`)
        .join("\n");

  const text = `You are a senior translation reviewer for ${sourceLang} → ${targetLang}.

# Severity rubric
- error: meaning-changing mistranslation, omission, addition, forbidden-term hit, broken placeholder, untranslated.
- warn:  fluency issue, awkward phrasing, terminology drift, register/tone mismatch, locale-formatting issue.
- info:  punctuation/whitespace nit, stylistic preference.

# Categories (pick one)
accuracy | terminology | fluency | grammar | register | punctuation | locale | style

# Target-language punctuation rules
${languageHint(targetLang)}
Evaluate punctuation against the TARGET language's conventions, not the source's.

# Glossary (must follow)
${glossaryBlock}

# Style guide
${styleGuide ?? "(no style guide attached — apply standard professional register)"}

# Output format
Return ONLY a JSON array, no prose. Each element:
{"segment_id": "<id>", "severity": "info|warn|error", "category": "<one of above>", "message": "<one sentence>", "suggested_target": "<optional improved target>"}

Only emit findings for genuine issues. If a segment is fine, do not emit anything for it. Do NOT repeat the same finding multiple times.`;

  return [
    {
      type: "text",
      text,
      cache_control: { type: "ephemeral" },
    },
  ];
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

interface UsageWithCache {
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;
}

function tallyUsage(u: UsageWithCache): OpusUsage {
  return {
    input_tokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
    cached_tokens: u.cache_read_input_tokens ?? 0,
    output_tokens: u.output_tokens ?? 0,
  };
}

export interface RunOpusArgs {
  sourceLang: string;
  targetLang: string;
  glossary: Array<{ source: string; target: string; notes?: string; status?: string }>;
  styleGuide?: string | null;
  segments: OpusBatchInput[];
  /** Hard cap in USD across all batches. Aborts further batches if exceeded. */
  costCapUsd?: number;
  apiKey?: string;
}

/**
 * Cost estimator (Opus 4.7 pricing as of 2026-04: $15/M input, $75/M output;
 * cached reads ~10% of input). Adjust if pricing changes.
 */
function estimateCostUsd(usage: OpusUsage): number {
  const inputCost = (usage.input_tokens / 1_000_000) * 15;
  const cachedCost = (usage.cached_tokens / 1_000_000) * 1.5;
  const outputCost = (usage.output_tokens / 1_000_000) * 75;
  return inputCost + cachedCost + outputCost;
}

export async function runOpusQa(args: RunOpusArgs): Promise<{
  findings: OpusFinding[];
  usage: OpusUsage;
  cost_usd: number;
  aborted: boolean;
}> {
  const apiKey = args.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });
  const system = buildSystemPrompt({
    sourceLang: args.sourceLang,
    targetLang: args.targetLang,
    glossary: args.glossary,
    styleGuide: args.styleGuide ?? null,
  });

  const findings: OpusFinding[] = [];
  const usage: OpusUsage = { input_tokens: 0, cached_tokens: 0, output_tokens: 0 };
  let aborted = false;
  const cap = args.costCapUsd ?? 5.0;

  for (const batch of chunk(args.segments, BATCH_SIZE)) {
    if (estimateCostUsd(usage) >= cap) {
      aborted = true;
      break;
    }

    const userText = `Review the following ${batch.length} segments. Emit a JSON array of findings only.\n\n${batch
      .map(
        (s) => `[${s.id}]\nSOURCE: ${s.source}\nTARGET: ${s.target}${s.prior_findings_summary ? `\nPRIOR: ${s.prior_findings_summary}` : ""}`,
      )
      .join("\n\n")}`;

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      messages: [{ role: "user", content: userText }],
    });

    const u = tallyUsage(res.usage as UsageWithCache);
    usage.input_tokens += u.input_tokens;
    usage.cached_tokens += u.cached_tokens;
    usage.output_tokens += u.output_tokens;

    const text = res.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const parsed = parseFindings(text);
    findings.push(...parsed);
  }

  return { findings, usage, cost_usd: estimateCostUsd(usage), aborted };
}

function parseFindings(text: string): OpusFinding[] {
  const trimmed = text.trim();
  // Be lenient: extract first [...] block.
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: OpusFinding[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.segment_id !== "string") continue;
    const sev = o.severity;
    if (sev !== "info" && sev !== "warn" && sev !== "error") continue;
    out.push({
      segment_id: o.segment_id,
      severity: sev,
      category: typeof o.category === "string" ? o.category : "fluency",
      message: typeof o.message === "string" ? o.message : "",
      suggested_target:
        typeof o.suggested_target === "string" && o.suggested_target.length > 0
          ? o.suggested_target
          : undefined,
    });
  }
  return out;
}

/** Map Opus severity → existing qa_findings severity column. */
export function mapOpusSeverity(s: OpusFinding["severity"]): QaSeverity {
  if (s === "error") return "critical";
  if (s === "warn") return "major";
  return "minor";
}

export type { QaFinding };
