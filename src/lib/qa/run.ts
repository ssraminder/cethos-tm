import { getServiceClient } from "@/lib/supabase/server";
import { getTermHitsForJob } from "@/lib/termbase/hits";
import { runRulesForSegments, type QaRule, type SegmentSnapshot, type ForbiddenTermHit } from "./rules";
import { fieldChecks } from "./field-rules";

export async function runQaForJob(jobId: string): Promise<{ inserted: number; findings_by_severity: Record<string, number>; rules_run: number }> {
  const supabase = await getServiceClient();

  // Find the job's QA profile (or default).
  const { data: job } = await supabase.from("jobs").select("qa_profile_id").eq("id", jobId).maybeSingle();
  if (!job) throw new Error("Job not found");

  let profileId = job.qa_profile_id;
  if (!profileId) {
    const { data: def } = await supabase.from("qa_profiles").select("id").eq("is_default", true).maybeSingle();
    profileId = def?.id ?? null;
  }
  if (!profileId) throw new Error("No QA profile set and no default profile exists.");

  const { data: profile } = await supabase.from("qa_profiles").select("rules").eq("id", profileId).maybeSingle();
  const rules = (profile?.rules ?? []) as QaRule[];

  // Load segments + termbase hits in parallel.
  const [segsRes, termHits] = await Promise.all([
    supabase.from("segments").select("id, source_text, target_text, status, meta").eq("job_id", jobId),
    getTermHitsForJob(jobId),
  ]);
  const segments: SegmentSnapshot[] = (segsRes.data ?? []) as SegmentSnapshot[];
  // Segments read from a page image (ID documents) also get the field checks:
  // dates, identifiers copied exactly, and letter-O / digit-0 confusion.
  const imageSegmentIds = new Set(
    ((segsRes.data ?? []) as Array<{ id: string; meta: { location?: { kind?: string } } | null }>)
      .filter((s) => s.meta?.location?.kind === "image_region")
      .map((s) => s.id),
  );

  // Build flat list of forbidden hits across all segments.
  const forbiddenTermHits: ForbiddenTermHit[] = [];
  for (const [segment_id, hits] of termHits.entries()) {
    for (const h of hits) {
      forbiddenTermHits.push({
        segment_id,
        source_term: h.source_term,
        target_term: h.target_term,
        source_status: h.source_status,
        target_status: h.target_status,
      });
    }
  }

  // Replace prior auto-findings for this job (preserve human-resolved/ignored).
  const segIds = segments.map((s) => s.id);
  if (segIds.length > 0) {
    await supabase
      .from("qa_findings")
      .delete()
      .in("segment_id", segIds)
      .is("resolved_at", null)
      .eq("ignored", false);
  }

  // On a scanned document a date, a name or a number is rightly identical to
  // the source, a field label added in English changes the length, and the
  // field checks below compare numbers and identifiers properly. So these
  // three general rules are not applied to fields read from an image.
  const SKIP_ON_IMAGE = new Set(["identical_source_target", "length_ratio", "number_mismatch"]);
  const excludedIds = new Set(
    ((segsRes.data ?? []) as Array<{ id: string; meta: { excluded?: unknown } | null }>)
      .filter((s) => s.meta?.excluded)
      .map((s) => s.id),
  );
  const findings = runRulesForSegments(rules, segments, { forbiddenTermHits }).filter(
    (f) => !excludedIds.has(f.segment_id) && !(imageSegmentIds.has(f.segment_id) && SKIP_ON_IMAGE.has(f.rule)),
  );
  for (const seg of segments) {
    if (!imageSegmentIds.has(seg.id) || excludedIds.has(seg.id)) continue;
    for (const c of fieldChecks(seg.source_text, seg.target_text ?? "")) {
      findings.push({ segment_id: seg.id, rule: `field_${c.rule}`, severity: c.severity, message: c.message });
    }
  }
  const findings_by_severity: Record<string, number> = { critical: 0, major: 0, minor: 0 };
  for (const f of findings) findings_by_severity[f.severity] = (findings_by_severity[f.severity] ?? 0) + 1;

  if (findings.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < findings.length; i += CHUNK) {
      await supabase.from("qa_findings").insert(findings.slice(i, i + CHUNK));
    }
  }

  return { inserted: findings.length, findings_by_severity, rules_run: rules.length };
}
