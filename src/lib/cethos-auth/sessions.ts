/**
 * Session lifecycle: create, get, refresh, revoke. Sessions are rows
 * in cethos_sessions; the cookie carries the session id and nothing
 * else (no JWT, no claims). Server reads the cookie, looks up the
 * session, joins to cethos_users, returns a CethosUser snapshot.
 *
 * Cookie scope is `.cethos.com` so the same id works across tm,
 * vendor, and admin subdomains in Phase 3 (cross-portal SSO).
 */

import { getServiceClient } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_DAYS,
  type CethosSession,
  type CethosUser,
} from "./schema";

export interface CreateSessionInput {
  user_id: string;
  ip_address?: string | null;
  user_agent?: string | null;
  ttl_days?: number;
}

export async function createSession(input: CreateSessionInput): Promise<CethosSession> {
  const supabase = await getServiceClient();
  const ttlDays = input.ttl_days ?? SESSION_TTL_DAYS;
  const expires_at = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("cethos_sessions")
    .insert({
      user_id: input.user_id,
      expires_at,
      ip_address: input.ip_address ?? null,
      user_agent: input.user_agent ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Session create failed: ${error?.message ?? "unknown"}`);
  }

  // Bump last_signed_in_at on the user row.
  await supabase
    .from("cethos_users")
    .update({ last_signed_in_at: new Date().toISOString() })
    .eq("id", input.user_id);

  return data as CethosSession;
}

export async function getSession(sessionId: string): Promise<CethosSession | null> {
  if (!sessionId) return null;
  const supabase = await getServiceClient();
  const { data } = await supabase
    .from("cethos_sessions")
    .select("*")
    .eq("id", sessionId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!data) return null;
  if (new Date((data as CethosSession).expires_at).getTime() <= Date.now()) return null;
  return data as CethosSession;
}

/**
 * Look up the full user behind a session id in one round-trip. Returns
 * null if the session is missing/expired/revoked or the user is
 * inactive. Use this for the per-request `getCurrentUser()` equivalent.
 */
export async function getSessionUser(sessionId: string): Promise<{ session: CethosSession; user: CethosUser } | null> {
  if (!sessionId) return null;
  const supabase = await getServiceClient();
  const { data } = await supabase
    .from("cethos_sessions")
    .select("*, cethos_users!inner(*)")
    .eq("id", sessionId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!data) return null;
  const session = data as CethosSession & { cethos_users: CethosUser | CethosUser[] };
  if (new Date(session.expires_at).getTime() <= Date.now()) return null;
  const userRel = session.cethos_users;
  const user = Array.isArray(userRel) ? userRel[0] : userRel;
  if (!user || user.is_active === false) return null;
  // Fire-and-forget: bump last_seen_at without blocking the request.
  void supabase
    .from("cethos_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", session.id);
  return { session: session as CethosSession, user };
}

export async function revokeSession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  const supabase = await getServiceClient();
  await supabase
    .from("cethos_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", sessionId);
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  const supabase = await getServiceClient();
  await supabase
    .from("cethos_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("revoked_at", null);
}

/** Cookie config — applied at the framework boundary (Next route handlers / actions). */
export interface CookieAttrs {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  domain?: string;
  maxAge: number; // seconds
}

export function buildSessionCookie(sessionId: string, ttlDays = SESSION_TTL_DAYS): CookieAttrs {
  return {
    name: SESSION_COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    // Domain set in production so the cookie is shared across subdomains.
    // In local dev we leave domain undefined so the cookie pins to localhost.
    domain: process.env.NODE_ENV === "production" ? ".cethos.com" : undefined,
    maxAge: ttlDays * 24 * 60 * 60,
  };
}

export function buildExpiredSessionCookie(): CookieAttrs {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    domain: process.env.NODE_ENV === "production" ? ".cethos.com" : undefined,
    maxAge: 0,
  };
}
