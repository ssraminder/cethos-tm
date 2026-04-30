/**
 * cethos_users CRUD. Read by every auth flow; written by sign-in (to
 * upsert on first OTP success) and by /account/security (set password,
 * change phone, toggle MFA).
 *
 * Phase 1: this lib is additive. No code calls it yet. Phase 2 wires
 * TM-Cethos's getCurrentUser to use getUserBySessionId.
 */

import { getServiceClient } from "@/lib/supabase/server";
import type { CethosUser } from "./schema";

export async function getUserById(id: string): Promise<CethosUser | null> {
  const supabase = await getServiceClient();
  const { data } = await supabase.from("cethos_users").select("*").eq("id", id).maybeSingle();
  return (data as CethosUser | null) ?? null;
}

export async function getUserByEmail(email: string): Promise<CethosUser | null> {
  const supabase = await getServiceClient();
  const { data } = await supabase
    .from("cethos_users")
    .select("*")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return (data as CethosUser | null) ?? null;
}

export async function getUserByPhone(phone: string): Promise<CethosUser | null> {
  const supabase = await getServiceClient();
  const { data } = await supabase
    .from("cethos_users")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();
  return (data as CethosUser | null) ?? null;
}

export interface UpsertOnSignInInput {
  email: string;
  phone?: string | null;
  full_name?: string | null;
  /** Default role for first-time sign-in. */
  default_role?: string;
  legacy_supabase_user_id?: string | null;
  legacy_vendor_session_id?: string | null;
}

/**
 * Find-or-create flow used by the sign-in OTP verify step. If we've
 * never seen this email before, create the user with the supplied
 * default role. If we have, leave the existing row alone (don't
 * overwrite name/role on every sign-in).
 */
export async function upsertOnSignIn(input: UpsertOnSignInInput): Promise<CethosUser> {
  const existing = await getUserByEmail(input.email);
  if (existing) return existing;

  const supabase = await getServiceClient();
  const { data, error } = await supabase
    .from("cethos_users")
    .insert({
      email: input.email.toLowerCase(),
      phone: input.phone ?? null,
      full_name: input.full_name ?? null,
      role: input.default_role ?? "translator",
      legacy_supabase_user_id: input.legacy_supabase_user_id ?? null,
      legacy_vendor_session_id: input.legacy_vendor_session_id ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`User upsert failed: ${error?.message ?? "unknown"}`);
  }
  return data as CethosUser;
}

export interface UpdatePasswordInput {
  user_id: string;
  password_hash: string | null;
}

export async function updatePasswordHash(input: UpdatePasswordInput): Promise<void> {
  const supabase = await getServiceClient();
  await supabase
    .from("cethos_users")
    .update({
      password_hash: input.password_hash,
      password_set_at: input.password_hash ? new Date().toISOString() : null,
    })
    .eq("id", input.user_id);
}

export async function setMfaRequired(user_id: string, required: boolean): Promise<void> {
  const supabase = await getServiceClient();
  await supabase.from("cethos_users").update({ mfa_required: required }).eq("id", user_id);
}

export async function setPhone(user_id: string, phone: string | null): Promise<void> {
  const supabase = await getServiceClient();
  await supabase.from("cethos_users").update({ phone }).eq("id", user_id);
}

export async function deactivate(user_id: string): Promise<void> {
  const supabase = await getServiceClient();
  await supabase.from("cethos_users").update({ is_active: false }).eq("id", user_id);
}
