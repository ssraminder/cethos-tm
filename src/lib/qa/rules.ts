export type QaSeverity = "critical" | "major" | "minor";

export interface QaRule {
  rule: string;
  severity: QaSeverity;
  params?: Record<string, unknown>;
}

export interface QaFinding {
  segment_id: string;
  rule: string;
  severity: QaSeverity;
  message: string;
}

export interface SegmentSnapshot {
  id: string;
  source_text: string;
  target_text: string;
  status: string;
}

export interface ForbiddenTermHit {
  segment_id: string;
  source_term: string;
  target_term: string;
  source_status: "approved" | "pending" | "forbidden";
  target_status: "approved" | "pending" | "forbidden";
}

export interface RuleContext {
  forbiddenTermHits?: ForbiddenTermHit[];
}

export type RuleFn = (seg: SegmentSnapshot, params: Record<string, unknown>, ctx: RuleContext) => QaFinding[];

const NUMBER_RE = /\d+(?:[.,]\d+)*/g;

const RULES: Record<string, RuleFn> = {
  untranslated: (seg, _p) => seg.target_text.trim().length === 0 && seg.status !== "untranslated"
    ? [{ segment_id: seg.id, rule: "untranslated", severity: "critical", message: "Target is empty." }]
    : [],

  identical_source_target: (seg) =>
    seg.target_text.trim() && seg.target_text.trim() === seg.source_text.trim()
      ? [{ segment_id: seg.id, rule: "identical_source_target", severity: "major", message: "Target identical to source." }]
      : [],

  number_mismatch: (seg) => {
    if (!seg.target_text.trim()) return [];
    const src = (seg.source_text.match(NUMBER_RE) ?? []).slice().sort();
    const tgt = (seg.target_text.match(NUMBER_RE) ?? []).slice().sort();
    if (src.join("|") === tgt.join("|")) return [];
    return [{
      segment_id: seg.id, rule: "number_mismatch", severity: "major",
      message: `Numbers differ. Source: [${src.join(", ")}]. Target: [${tgt.join(", ")}].`,
    }];
  },

  length_ratio: (seg, params) => {
    if (!seg.target_text.trim()) return [];
    const min = Number(params?.min ?? 0.5);
    const max = Number(params?.max ?? 2.5);
    const sLen = seg.source_text.length;
    const tLen = seg.target_text.length;
    if (sLen === 0) return [];
    const ratio = tLen / sLen;
    if (ratio < min || ratio > max) {
      return [{
        segment_id: seg.id, rule: "length_ratio", severity: "minor",
        message: `Target/source length ratio ${ratio.toFixed(2)} is outside [${min}, ${max}].`,
      }];
    }
    return [];
  },

  leading_trailing_whitespace: (seg) => {
    if (!seg.target_text) return [];
    const srcLead = /^\s/.test(seg.source_text);
    const srcTrail = /\s$/.test(seg.source_text);
    const tgtLead = /^\s/.test(seg.target_text);
    const tgtTrail = /\s$/.test(seg.target_text);
    if (srcLead === tgtLead && srcTrail === tgtTrail) return [];
    return [{
      segment_id: seg.id, rule: "leading_trailing_whitespace", severity: "minor",
      message: `Whitespace mismatch (lead: ${srcLead}/${tgtLead}, trail: ${srcTrail}/${tgtTrail}).`,
    }];
  },

  double_space: (seg) => seg.target_text.includes("  ")
    ? [{ segment_id: seg.id, rule: "double_space", severity: "minor", message: "Target contains double spaces." }]
    : [],

  tag_mismatch: (seg) => {
    if (!seg.target_text.trim()) return [];
    const ids = (s: string) => {
      const set = new Set<number>();
      const re = /\{(\d+)\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(s)) !== null) set.add(Number(m[1]));
      return set;
    };
    const src = ids(seg.source_text);
    if (src.size === 0) return [];
    const tgt = ids(seg.target_text);
    const missing = [...src].filter((x) => !tgt.has(x));
    const extra = [...tgt].filter((x) => !src.has(x));
    if (missing.length === 0 && extra.length === 0) return [];
    const parts: string[] = [];
    if (missing.length) parts.push(`missing: ${missing.map((n) => `{${n}}`).join(", ")}`);
    if (extra.length) parts.push(`extra: ${extra.map((n) => `{${n}}`).join(", ")}`);
    return [{
      segment_id: seg.id, rule: "tag_mismatch", severity: "critical",
      message: `Inline tags differ — ${parts.join("; ")}.`,
    }];
  },

  forbidden_term: (seg, _p, ctx) => {
    const hits = (ctx.forbiddenTermHits ?? []).filter((h) => h.segment_id === seg.id && h.target_status === "forbidden");
    if (hits.length === 0 || !seg.target_text) return [];
    const findings: QaFinding[] = [];
    const lc = seg.target_text.toLowerCase();
    for (const h of hits) {
      if (lc.includes(h.target_term.toLowerCase())) {
        findings.push({
          segment_id: seg.id, rule: "forbidden_term", severity: "major",
          message: `Forbidden term "${h.target_term}" appears in target.`,
        });
      }
    }
    return findings;
  },
};

export function runRulesForSegments(
  rules: QaRule[],
  segments: SegmentSnapshot[],
  ctx: RuleContext,
): QaFinding[] {
  const findings: QaFinding[] = [];
  for (const seg of segments) {
    for (const r of rules) {
      const fn = RULES[r.rule];
      if (!fn) continue;
      const out = fn(seg, r.params ?? {}, ctx);
      for (const f of out) findings.push({ ...f, severity: r.severity ?? f.severity });
    }
  }
  return findings;
}
