import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

let cached: SupabaseClient | null = null;

export function isPortalConfigured(): boolean {
  return !!(env.portal.url && env.portal.serviceRoleKey);
}

/**
 * Service-role client pointing at the shared admin / vendor-portal Supabase
 * backend (`lmzoyezvsjgsxveoakdr`). Used to pull customers + vendors into
 * the CAT tool's local mirror.
 *
 * Throws if PORTAL_SUPABASE_URL / PORTAL_SUPABASE_SERVICE_ROLE_KEY are not set.
 */
export function getPortalClient(): SupabaseClient {
  if (!isPortalConfigured()) {
    throw new Error("Portal Supabase not configured (PORTAL_SUPABASE_URL / PORTAL_SUPABASE_SERVICE_ROLE_KEY).");
  }
  if (cached) return cached;
  cached = createClient(env.portal.url, env.portal.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });
  return cached;
}
