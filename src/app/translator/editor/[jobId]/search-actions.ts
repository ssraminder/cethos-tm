"use server";

import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Manual TM concordance search — translator types a phrase, we ILIKE-search
 * the source_text / target_text of every tm_unit in TMs attached to this
 * specific job. Results are language-pair-filtered (the job's source_lang
 * → target_lang) so cross-pair matches don't leak in. Each result carries
 * the TM name + created_at so translators can prefer fresher entries.
 */

const TmSearchSchema = z.object({
  job_id: z.string().uuid(),
  query: z.string().trim().min(2).max(500),
  limit: z.number().int().min(1).max(50).optional(),
});

export interface TmSearchResult {
  unit_id: string;
  source_text: string;
  target_text: string;
  tm_id: string;
  tm_name: string;
  created_at: string;
}

export type TmSearchResponse =
  | { ok: true; results: TmSearchResult[] }
  | { ok: false; error: string };

export async function searchTmAction(input: {
  job_id: string;
  query: string;
  limit?: number;
}): Promise<TmSearchResponse> {
  const me = await getCurrentUser();
  const parsed = TmSearchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { job_id, query } = parsed.data!;
  const limit = parsed.data!.limit ?? 25;

  const supabase = await getServiceClient();

  // Authorization + job lookup (need source/target lang for filtering).
  const { data: job } = await supabase
    .from("jobs")
    .select("id, assigned_to, reviewer_id, source_lang, target_lang")
    .eq("id", job_id)
    .maybeSingle();
  if (!job) return { ok: false, error: "Job not found" };
  const j = job as {
    id: string;
    assigned_to: string | null;
    reviewer_id: string | null;
    source_lang: string;
    target_lang: string;
  };
  const ok =
    j.assigned_to === me.id ||
    j.reviewer_id === me.id ||
    me.role === "admin" ||
    me.role === "pm";
  if (!ok) return { ok: false, error: "Forbidden" };

  // 1. Resolve TM ids attached to this job that match the language pair.
  //    (Default TMs are pair-specific; staff-attached TMs might be too.)
  const { data: attached } = await supabase
    .from("job_resources")
    .select("resource_id, translation_memories!inner(id, name, source_lang, target_lang)")
    .eq("job_id", job_id)
    .eq("resource_type", "tm");

  // Postgrest's TS inference treats embedded relations as arrays even when
  // the FK cardinality is many-to-one. Normalise via a runtime guard.
  type AttachedRow = {
    resource_id: string;
    translation_memories:
      | { id: string; name: string; source_lang: string; target_lang: string }
      | { id: string; name: string; source_lang: string; target_lang: string }[];
  };
  const pickTm = (r: AttachedRow) =>
    Array.isArray(r.translation_memories)
      ? r.translation_memories[0]
      : r.translation_memories;

  const tmRows = ((attached ?? []) as AttachedRow[]).filter((r) => {
    const tm = pickTm(r);
    return tm && tm.source_lang === j.source_lang && tm.target_lang === j.target_lang;
  });
  if (tmRows.length === 0) {
    return { ok: true, results: [] };
  }
  const tmIds = tmRows.map((r) => pickTm(r).id);
  const tmNameById = new Map<string, string>();
  for (const r of tmRows) {
    const tm = pickTm(r);
    tmNameById.set(tm.id, tm.name);
  }

  // 2. ILIKE on source OR target. Postgrest .or() syntax.
  const escaped = query.replace(/[%_]/g, (m) => `\\${m}`);
  const { data: units, error } = await supabase
    .from("tm_units")
    .select("id, tm_id, source_text, target_text, created_at")
    .in("tm_id", tmIds)
    .or(`source_text.ilike.%${escaped}%,target_text.ilike.%${escaped}%`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { ok: false, error: error.message };

  const results: TmSearchResult[] = (units ?? []).map((u) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = u as any;
    return {
      unit_id: row.id,
      source_text: row.source_text,
      target_text: row.target_text,
      tm_id: row.tm_id,
      tm_name: tmNameById.get(row.tm_id) ?? "TM",
      created_at: row.created_at,
    };
  });
  return { ok: true, results };
}

/**
 * Glossary search across termbases attached to this job. Filtered by the
 * job's source/target language pair — only entries in those two languages
 * are searched, and we group by concept so translators see the
 * source-term ↔ target-term pair.
 */

const GlossarySearchSchema = z.object({
  job_id: z.string().uuid(),
  query: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(50).optional(),
});

export interface GlossaryHit {
  concept_id: string;
  termbase_id: string;
  termbase_name: string;
  source_term: string;
  source_status: string;
  target_term: string;
  target_status: string;
  definition: string | null;
  domain: string | null;
}

export type GlossarySearchResponse =
  | { ok: true; results: GlossaryHit[] }
  | { ok: false; error: string };

/**
 * Map BCP-47-ish codes to broader language codes for term entry matching.
 * Termbases store entries by their original language tag; we want
 * "en" + "en-US" + "en-GB" to all match if the job is "en".
 */
function langVariants(code: string): string[] {
  const root = code.split("-")[0];
  return [code, root].filter((v, i, a) => a.indexOf(v) === i);
}

export async function searchGlossaryAction(input: {
  job_id: string;
  query: string;
  limit?: number;
}): Promise<GlossarySearchResponse> {
  const me = await getCurrentUser();
  const parsed = GlossarySearchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { job_id, query } = parsed.data!;
  const limit = parsed.data!.limit ?? 25;

  const supabase = await getServiceClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, assigned_to, reviewer_id, source_lang, target_lang")
    .eq("id", job_id)
    .maybeSingle();
  if (!job) return { ok: false, error: "Job not found" };
  const j = job as {
    id: string;
    assigned_to: string | null;
    reviewer_id: string | null;
    source_lang: string;
    target_lang: string;
  };
  const ok =
    j.assigned_to === me.id ||
    j.reviewer_id === me.id ||
    me.role === "admin" ||
    me.role === "pm";
  if (!ok) return { ok: false, error: "Forbidden" };

  const { data: attached } = await supabase
    .from("job_resources")
    .select("resource_id, termbases!inner(id, name)")
    .eq("job_id", job_id)
    .eq("resource_type", "termbase");

  type AttachedTb = {
    resource_id: string;
    termbases: { id: string; name: string } | { id: string; name: string }[];
  };
  const pickTb = (r: AttachedTb) =>
    Array.isArray(r.termbases) ? r.termbases[0] : r.termbases;

  const tbRows = ((attached ?? []) as AttachedTb[]).filter((r) => !!pickTb(r));
  const tbIds = tbRows.map((r) => pickTb(r).id);
  if (tbIds.length === 0) {
    return { ok: true, results: [] };
  }
  const tbNameById = new Map<string, string>();
  for (const r of tbRows) {
    const tb = pickTb(r);
    tbNameById.set(tb.id, tb.name);
  }

  // Find concepts in attached termbases that have an entry matching the
  // query in EITHER the source or target language.
  const escaped = query.replace(/[%_]/g, (m) => `\\${m}`);
  const sourceLangs = langVariants(j.source_lang);
  const targetLangs = langVariants(j.target_lang);

  const { data: matchingEntries, error: e1 } = await supabase
    .from("term_entries")
    .select("id, concept_id, language, term, status, term_concepts!inner(termbase_id, domain, definition)")
    .ilike("term", `%${escaped}%`)
    .in("language", [...sourceLangs, ...targetLangs])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter("term_concepts.termbase_id", "in", `(${tbIds.map((id) => `"${id}"`).join(",")})`)
    .limit(limit * 4);
  if (e1) return { ok: false, error: e1.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conceptIds = Array.from(new Set((matchingEntries ?? []).map((e: any) => e.concept_id as string)));
  if (conceptIds.length === 0) return { ok: true, results: [] };

  // Pull the source + target entries for each concept (we need both langs
  // even if only one matched the query).
  const { data: allEntries, error: e2 } = await supabase
    .from("term_entries")
    .select("concept_id, language, term, status, term_concepts!inner(termbase_id, domain, definition)")
    .in("concept_id", conceptIds);
  if (e2) return { ok: false, error: e2.message };

  // Group by concept_id and pick source / target lang variants.
  const byConcept = new Map<string, {
    termbase_id: string;
    domain: string | null;
    definition: string | null;
    source_term: string | null;
    source_status: string | null;
    target_term: string | null;
    target_status: string | null;
  }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const e of (allEntries ?? []) as any[]) {
    const concept = Array.isArray(e.term_concepts)
      ? e.term_concepts[0]
      : e.term_concepts;
    if (!concept) continue;
    const isSrc = sourceLangs.includes(e.language);
    const isTgt = targetLangs.includes(e.language);
    if (!isSrc && !isTgt) continue;
    const cur = byConcept.get(e.concept_id) ?? {
      termbase_id: concept.termbase_id,
      domain: concept.domain,
      definition: concept.definition,
      source_term: null,
      source_status: null,
      target_term: null,
      target_status: null,
    };
    if (isSrc && !cur.source_term) {
      cur.source_term = e.term;
      cur.source_status = e.status;
    }
    if (isTgt && !cur.target_term) {
      cur.target_term = e.term;
      cur.target_status = e.status;
    }
    byConcept.set(e.concept_id, cur);
  }

  const results: GlossaryHit[] = [];
  for (const [concept_id, c] of byConcept) {
    if (!c.source_term || !c.target_term) continue;
    results.push({
      concept_id,
      termbase_id: c.termbase_id,
      termbase_name: tbNameById.get(c.termbase_id) ?? "Termbase",
      source_term: c.source_term,
      source_status: c.source_status ?? "approved",
      target_term: c.target_term,
      target_status: c.target_status ?? "approved",
      definition: c.definition,
      domain: c.domain,
    });
    if (results.length >= limit) break;
  }
  return { ok: true, results };
}
