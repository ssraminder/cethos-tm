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
 * Insert a confirmed source-target pair into the given TM. Idempotent on
 * (tm_id, source_hash, target_text) — re-confirming the same segment with
 * the same translation is a no-op.
 *
 * source_hash is computed by a DB trigger on tm_units, so we don't compute
 * it here.
 */
export async function upsertTmUnit(args: {
  tm_id: string;
  source_text: string;
  target_text: string;
  domain?: string | null;
  meta?: Record<string, unknown> | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await getServiceClient();
  const { error } = await supabase.from("tm_units").upsert(
    {
      tm_id: args.tm_id,
      source_text: args.source_text,
      target_text: args.target_text,
      domain: args.domain ?? null,
      meta: args.meta ?? {},
    },
    { onConflict: "tm_id,source_hash,target_text", ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
