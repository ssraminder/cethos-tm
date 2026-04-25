import { getServiceClient } from "@/lib/supabase/server";

export interface TermHit {
  concept_id: string;
  source_term: string;
  source_status: "approved" | "pending" | "forbidden";
  target_term: string;
  target_status: "approved" | "pending" | "forbidden";
  match_start: number;
  match_len: number;
}

/**
 * Returns a map<segment_id, TermHit[]> for every term-hit found in a job's
 * segments via attached termbases. One round-trip via SQL function.
 */
export async function getTermHitsForJob(jobId: string): Promise<Map<string, TermHit[]>> {
  const supabase = await getServiceClient();
  const { data, error } = await supabase.rpc("find_term_hits_for_job", { p_job_id: jobId });
  if (error) throw new Error(`Term-hits RPC failed: ${error.message}`);

  type Row = {
    segment_id: string;
    concept_id: string;
    source_term: string;
    source_status: TermHit["source_status"];
    target_term: string;
    target_status: TermHit["target_status"];
    match_start: number;
    match_len: number;
  };

  const map = new Map<string, TermHit[]>();
  for (const row of (data ?? []) as Row[]) {
    const arr = map.get(row.segment_id) ?? [];
    arr.push({
      concept_id: row.concept_id,
      source_term: row.source_term,
      source_status: row.source_status,
      target_term: row.target_term,
      target_status: row.target_status,
      match_start: row.match_start,
      match_len: row.match_len,
    });
    map.set(row.segment_id, arr);
  }
  return map;
}
