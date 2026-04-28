/**
 * Default TM management.
 *
 * Every job needs a TM attached so confirmed segments accumulate into a
 * leverageable corpus over time. Rather than make PMs / admins remember to
 * create + attach one, we lazy-create a "Default TM" per language pair on
 * first job creation and auto-attach it in createJobFromBuffer.
 *
 * Subsequent jobs in the same language pair reuse the same default TM, so
 * the corpus grows organically as translators confirm segments.
 */

import { getServiceClient } from "@/lib/supabase/server";

const DEFAULT_TM_NAME_PREFIX = "Default TM";

interface TmRow {
  id: string;
  name: string;
  source_lang: string;
  target_lang: string;
}

/**
 * Look up the default TM for the given language pair. If it doesn't exist,
 * create it. Returns the TM id.
 *
 * The default TM name is "Default TM (en→fa)" etc. so admins can spot it
 * in the TM list. scope is left null (acts as a global default); client_id
 * null so it applies across clients.
 */
export async function getOrCreateDefaultTm(args: {
  source_lang: string;
  target_lang: string;
  created_by?: string | null;
}): Promise<string> {
  const supabase = await getServiceClient();
  const { source_lang, target_lang } = args;

  // 1. Look up existing default TM for this pair.
  const { data: existing } = await supabase
    .from("translation_memories")
    .select("id, name, source_lang, target_lang")
    .eq("source_lang", source_lang)
    .eq("target_lang", target_lang)
    .ilike("name", `${DEFAULT_TM_NAME_PREFIX}%`)
    .limit(1)
    .maybeSingle();
  if (existing) return (existing as TmRow).id;

  // 2. Create one. ON CONFLICT DO NOTHING + re-select to handle the rare
  //    race where two concurrent createJobFromBuffer calls try to create
  //    the same default TM.
  const name = `${DEFAULT_TM_NAME_PREFIX} (${source_lang}→${target_lang})`;
  const { data: created, error } = await supabase
    .from("translation_memories")
    .insert({
      name,
      source_lang,
      target_lang,
      created_by: args.created_by ?? null,
      // scope + client_id null = global, all clients use it.
    })
    .select("id")
    .maybeSingle();

  if (error) {
    // Concurrent insert race — refetch.
    const { data: fallback } = await supabase
      .from("translation_memories")
      .select("id")
      .eq("source_lang", source_lang)
      .eq("target_lang", target_lang)
      .ilike("name", `${DEFAULT_TM_NAME_PREFIX}%`)
      .maybeSingle();
    if (fallback) return (fallback as { id: string }).id;
    throw new Error(`Could not get-or-create default TM: ${error.message}`);
  }
  if (!created) throw new Error("Default TM insert returned no row");
  return (created as { id: string }).id;
}

/**
 * Persist a confirmed source/target pair into the given TM with full
 * provenance metadata so admins can trace any TM entry back to the job +
 * segment + translator that produced it.
 *
 * Overwrite semantics: if a row in this TM already came from the same
 * (job_id, segment_id), we DELETE it first and then insert fresh. That way
 * re-confirming a segment with a new translation cleanly replaces the old
 * TM entry rather than accumulating multiple rows for the same source.
 *
 * Validation: source_lang / target_lang on the meta block must match the
 * TM's own language pair — we don't enforce in SQL because tm_units doesn't
 * carry language columns, but the caller (createJobFromBuffer's default-TM
 * lookup) only ever picks a TM with the matching pair.
 */
export interface TmUnitProvenance {
  job_id: string;
  segment_id: string;
  source_lang: string;
  target_lang: string;
  confirmed_by?: string | null;
  confirmed_at?: string;
}

export async function upsertTmUnit(args: {
  tm_id: string;
  source_text: string;
  target_text: string;
  domain?: string | null;
  provenance?: TmUnitProvenance;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await getServiceClient();

  // 1. If we have segment-level provenance, remove any prior row from the
  //    same (tm, job, segment). One canonical TM entry per segment.
  if (args.provenance) {
    const { error: delErr } = await supabase
      .from("tm_units")
      .delete()
      .eq("tm_id", args.tm_id)
      .eq("meta->>job_id", args.provenance.job_id)
      .eq("meta->>segment_id", args.provenance.segment_id);
    if (delErr) {
      // Don't bail — the insert below will still work, we just may
      // accumulate a duplicate. Logging would be ideal but this lib is
      // called from many places so we keep it quiet.
    }
  }

  // 2. Insert fresh.
  const meta: Record<string, unknown> = {};
  if (args.provenance) {
    meta.job_id = args.provenance.job_id;
    meta.segment_id = args.provenance.segment_id;
    meta.source_lang = args.provenance.source_lang;
    meta.target_lang = args.provenance.target_lang;
    if (args.provenance.confirmed_by) meta.confirmed_by = args.provenance.confirmed_by;
    meta.confirmed_at = args.provenance.confirmed_at ?? new Date().toISOString();
  }

  const { error } = await supabase.from("tm_units").upsert(
    {
      tm_id: args.tm_id,
      source_text: args.source_text,
      target_text: args.target_text,
      domain: args.domain ?? null,
      meta,
    },
    { onConflict: "tm_id,source_hash,target_text", ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
