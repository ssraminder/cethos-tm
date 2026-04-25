import { getServiceClient } from "@/lib/supabase/server";

export interface TmMatch {
  unit_id: string;
  tm_id: string;
  tm_name?: string | null;
  source_text: string;
  target_text: string;
  score: number;            // 0..1
  kind: "exact" | "fuzzy";
  quality_score?: number | null;
}

/**
 * Pre-compute exact matches for every segment in a job in a single round-trip.
 * Returns: map<segment_id, top exact match>.
 *
 * Source hash is computed by trigger using the same normalization rule on insert.
 * Job-segment source_hash is set by the segmentation pipeline using the same
 * canonical normalization, so an exact match means the normalized texts agree.
 */
export async function getExactMatchesForJob(jobId: string): Promise<Map<string, TmMatch>> {
  const supabase = await getServiceClient();

  // Single-query: join segments → tm_units by source_hash, restricted to the
  // TMs attached to the job and matching the job's language pair.
  const { data, error } = await supabase.rpc("find_exact_matches_for_job", { p_job_id: jobId });
  if (error) throw new Error(`Match RPC failed: ${error.message}`);

  const map = new Map<string, TmMatch>();
  for (const row of (data ?? []) as Array<{
    segment_id: string;
    unit_id: string;
    tm_id: string;
    tm_name: string | null;
    source_text: string;
    target_text: string;
    quality_score: number | null;
    priority: number | null;
  }>) {
    // Keep highest-priority TM (lower priority number = higher priority).
    const existing = map.get(row.segment_id);
    if (!existing || (row.priority ?? 999) < (existing.score ?? 999)) {
      map.set(row.segment_id, {
        unit_id: row.unit_id,
        tm_id: row.tm_id,
        tm_name: row.tm_name,
        source_text: row.source_text,
        target_text: row.target_text,
        score: 1,
        kind: "exact",
        quality_score: row.quality_score,
      });
    }
  }
  return map;
}

/**
 * Fuzzy + exact match search for a single segment (called on demand from the editor).
 */
export async function findMatchesForSegment(jobId: string, sourceText: string, limit = 5): Promise<TmMatch[]> {
  const supabase = await getServiceClient();
  const { data, error } = await supabase.rpc("find_tm_matches", {
    p_job_id: jobId,
    p_source: sourceText,
    p_limit: limit,
  });
  if (error) throw new Error(`Match RPC failed: ${error.message}`);

  type Row = {
    tm_id: string;
    unit_id: string;
    source_text: string;
    target_text: string;
    quality_score: number | null;
    kind: string;
    score: number;
  };
  const rows = (data ?? []) as Row[];
  const tmIds = Array.from(new Set(rows.map((r) => r.tm_id)));
  let names: Record<string, string> = {};
  if (tmIds.length > 0) {
    const { data: tms } = await supabase
      .from("translation_memories")
      .select("id, name")
      .in("id", tmIds);
    names = Object.fromEntries((tms ?? []).map((t) => [t.id, t.name]));
  }

  return rows.map((row) => ({
    unit_id: row.unit_id,
    tm_id: row.tm_id,
    tm_name: names[row.tm_id] ?? null,
    source_text: row.source_text,
    target_text: row.target_text,
    score: Number(row.score),
    kind: row.kind as "exact" | "fuzzy",
    quality_score: row.quality_score ?? null,
  }));
}
