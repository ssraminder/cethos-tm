/**
 * getCurrentUser — the per-request identity hook used across TM pages
 * and API routes. Returns a `CurrentUser` shape that's stable across
 * both auth backends:
 *
 *   1. **cethos-auth session** (`cethos_session_tm` cookie + cethos_users
 *      row). New path. Federated SSO from vendor portal lands here.
 *      China-friendly because the receiving end never calls
 *      `supabase.auth.*` from the browser.
 *
 *   2. **Legacy Supabase Auth session** (Supabase cookies + `profiles`
 *      row). Existing direct sign-in (/sign-in → /verify magic link)
 *      still routes through Supabase Auth for now. Kept so the migration
 *      to cethos-auth can ship incrementally without breaking PMs/admins.
 *
 * Lookup priority is cethos-first. If a user has both cookies (rare —
 * happens during the cutover), the cethos session wins. The Supabase
 * fallback is dropped in a later phase once /sign-in + /verify are
 * rewritten to also use cethos-auth.
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/cethos-auth/sessions";
import { SESSION_COOKIE_NAME } from "@/lib/cethos-auth/schema";

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "pm" | "translator" | "reviewer";
  status: "pending" | "active" | "suspended";
  /** Which auth backend produced this snapshot. */
  source: "cethos" | "supabase";
}

type DbRole = CurrentUser["role"];

function normalizeRole(raw: string | null | undefined): DbRole {
  if (raw === "admin" || raw === "pm" || raw === "translator" || raw === "reviewer") {
    return raw;
  }
  return "translator";
}

export async function getCurrentUser(): Promise<CurrentUser> {
  // 1) Try cethos-auth session cookie first.
  const cookieStore = await cookies();
  const cethosSessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (cethosSessionId) {
    const result = await getSessionUser(cethosSessionId);
    if (result) {
      const { user } = result;
      return {
        id: user.id,
        email: user.email,
        full_name: user.full_name ?? null,
        role: normalizeRole(user.role),
        // cethos_users.is_active is the source-of-truth here; mapping
        // the boolean to the legacy string enum so callers don't care
        // which backend produced the row.
        status: user.is_active === false ? "suspended" : "active",
        source: "cethos",
      };
    }
    // Cookie was present but invalid (revoked / expired / unknown).
    // Fall through to Supabase as a last attempt — handles the case
    // where a stale cethos cookie shadows a valid Supabase session.
  }

  // 2) Legacy Supabase Auth path.
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const service = await getServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id, email, full_name, role, status")
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile) redirect("/sign-in");
  return {
    ...(profile as Omit<CurrentUser, "source">),
    source: "supabase",
  };
}

export async function requireRole(roles: Array<CurrentUser["role"]>): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}
