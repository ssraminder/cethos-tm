/**
 * Standalone concordance search — ILIKE-search across TM units that the
 * caller has access to:
 *   - admin / pm: search across every translation_memory
 *   - translator / reviewer: search across TMs attached to any job the
 *     user is assigned to or reviewing
 *
 * Returns up to `limit` results with TM name + created_at so translators
 * can prefer fresher entries. Results are sorted by recency.
 */

import { getServiceClient } from "@/lib/supabase/server";

export interface ConcordanceResult {
  unit_id: string;
  source_text: string;
  target_text: string;
  tm_id: string;
  tm_name: string;
  source_lang: string;
  target_lang: string;
  created_at: string;
}

export async function searchConcordance(args: {
  query: string;
  user_id: string;
  role: "admin" | "pm" | "translator" | "reviewer" | string;
  limit?: number;
}): Promise<ConcordanceResult[]> {
  const q = args.query.trim();
  if (q.length < 2) return [];
  const limit = args.limit ?? 25;
  const supabase = await getServiceClient();

  // Resolve the set of TM ids the caller can see.
  let tmIds: string[];
  if (args.role === "admin" || args.role === "pm") {
    const { data } = await supabase.from("translation_memories").select("id");
    tmIds = (data ?? []).map((r) => (r as { id: string }).id);
  } else {
    // Translator/reviewer: TMs attached to any of their assigned jobs.
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id")
      .or(`assigned_to.eq.${args.user_id},reviewer_id.eq.${args.user_id}`);
    const jobIds = (jobs ?? []).map((r) => (r as { id: string }).id);
    if (jobIds.length === 0) return [];
    const { data: attached } = await supabase
      .from("job_resources")
      .select("resource_id")
      .in("job_id", jobIds)
      .eq("resource_type", "tm");
    tmIds = Array.from(new Set((attached ?? []).map((r) => (r as { resource_id: string }).resource_id)));
  }
  if (tmIds.length === 0) return [];

  const escaped = q.replace(/[%_]/g, (c) => `\\${c}`);
  const pattern = `%${escaped}%`;

  const { data: units } = await supabase
    .from("tm_units")
    .select(
      "id, source_text, target_text, created_at, translation_memories!inner(id, name, source_lang, target_lang)",
    )
    .in("tm_id", tmIds)
    .or(`source_text.ilike.${pattern},target_text.ilike.${pattern}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  type Row = {
    id: string;
    source_text: string;
    target_text: string;
    created_at: string;
    translation_memories:
      | { id: string; name: string; source_lang: string; target_lang: string }
      | { id: string; name: string; source_lang: string; target_lang: string }[];
  };
  const out: ConcordanceResult[] = [];
  for (const u of (units ?? []) as Row[]) {
    const tm = Array.isArray(u.translation_memories) ? u.translation_memories[0] : u.translation_memories;
    if (!tm) continue;
    out.push({
      unit_id: u.id,
      source_text: u.source_text,
      target_text: u.target_text,
      tm_id: tm.id,
      tm_name: tm.name,
      source_lang: tm.source_lang,
      target_lang: tm.target_lang,
      created_at: u.created_at,
    });
  }
  return out;
}
