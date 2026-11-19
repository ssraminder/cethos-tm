/**
 * Third-party AI policy.
 *
 * "Third-party AI" is any call that sends job content to an outside AI
 * provider: DeepL and Google Translate (machine translation) and the Claude
 * Opus QA pass. Each job carries jobs.third_party_ai_allowed, which is OFF
 * unless a PM or admin (or the portal, at ingest) turns it on.
 *
 * Every place that would call one of those providers must check
 * isThirdPartyAiAllowed() first and call auditThirdPartyAiCall() when it
 * does send content, so there is a complete record of what left the platform.
 */

import { getServiceClient } from "@/lib/supabase/server";
import { audit } from "@/lib/auth/audit";

export const THIRD_PARTY_AI_OFF_MESSAGE =
  "Third-party AI is turned off for this job, so its content is not sent to outside providers.";

export type ThirdPartyAiProvider = "deepl" | "google" | "anthropic";

/** Fails closed: an unknown job or a read error counts as not allowed. */
export async function isThirdPartyAiAllowed(jobId: string): Promise<boolean> {
  const supabase = await getServiceClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("third_party_ai_allowed")
    .eq("id", jobId)
    .maybeSingle();
  if (error || !data) return false;
  return data.third_party_ai_allowed === true;
}

/** Default for a new job: the client's setting, or off when there is no client. */
export async function defaultThirdPartyAiForClient(clientId: string | null | undefined): Promise<boolean> {
  if (!clientId) return false;
  const supabase = await getServiceClient();
  const { data, error } = await supabase
    .from("clients")
    .select("third_party_ai_allowed")
    .eq("id", clientId)
    .maybeSingle();
  if (error || !data) return false;
  return data.third_party_ai_allowed === true;
}

export async function auditThirdPartyAiCall(ev: {
  jobId: string;
  provider: ThirdPartyAiProvider;
  purpose: "machine_translation" | "qa_review";
  actorId?: string | null;
  actorEmail?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await audit({
    category: "integration",
    action: "third_party_ai_call",
    actorId: ev.actorId ?? null,
    actorEmail: ev.actorEmail ?? null,
    targetType: "job",
    targetId: ev.jobId,
    meta: { provider: ev.provider, purpose: ev.purpose, ...(ev.meta ?? {}) },
  });
}
