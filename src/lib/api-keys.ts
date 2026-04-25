import { createHash, randomBytes } from "node:crypto";
import { env } from "./env";
import { getServiceClient } from "./supabase/server";

export type ApiKeyScope = "tms_ingest" | "webhook_callback";

export interface ApiKeyRecord {
  id: string;
  name: string;
  scope: ApiKeyScope;
  client_id: string | null;
  created_by: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

const PREFIX_LEN = 8;

/**
 * Mint a new API key. Returns the plaintext value ONCE — caller is
 * responsible for showing it to the admin and we never store it.
 *
 * Format: cethos_{scope}_{32 hex chars}
 */
export async function mintApiKey(opts: {
  name: string;
  scope: ApiKeyScope;
  created_by: string;
  client_id?: string | null;
  expires_at?: string | null;
}): Promise<{ id: string; plaintext: string; prefix: string }> {
  const random = randomBytes(24).toString("hex");
  const plaintext = `cethos_${opts.scope === "tms_ingest" ? "tms" : "wh"}_${random}`;
  const prefix = plaintext.slice(0, PREFIX_LEN);
  const keyHash = hashKey(plaintext);

  const supabase = await getServiceClient();
  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      name: opts.name,
      scope: opts.scope,
      key_prefix: prefix,
      key_hash: keyHash,
      created_by: opts.created_by,
      client_id: opts.client_id ?? null,
      expires_at: opts.expires_at ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Mint failed: ${error?.message ?? "unknown"}`);
  return { id: data.id, plaintext, prefix };
}

function hashKey(plaintext: string): string {
  return createHash("sha256").update(`${env.appSecret}:${plaintext}`).digest("hex");
}

/**
 * Verify a presented API key. Returns the matched record or null.
 * Updates last_used_at on success.
 */
export async function verifyApiKey(plaintext: string, requiredScope: ApiKeyScope): Promise<ApiKeyRecord | null> {
  if (!plaintext || plaintext.length < 16) return null;
  const keyHash = hashKey(plaintext);

  const supabase = await getServiceClient();
  const { data } = await supabase
    .from("api_keys")
    .select("id, name, scope, client_id, created_by, last_used_at, expires_at, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (!data) return null;
  if (data.revoked_at) return null;
  if (data.scope !== requiredScope) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data as ApiKeyRecord;
}
