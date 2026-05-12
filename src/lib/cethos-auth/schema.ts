/**
 * Shared types for Cethos auth (Phase 1 of the Supabase Auth retirement).
 *
 * These types describe the rows in the new auth tables and the shape of
 * sessions/cookies. The lib is copied verbatim into the vendor and admin
 * portals in Phase 3 so all three apps share one session model.
 */

export type CethosRole = "admin" | "pm" | "translator" | "reviewer" | "vendor";

export interface CethosUser {
  id: string;
  email: string;
  phone: string | null;
  full_name: string | null;
  role: CethosRole | string;
  password_hash: string | null;
  password_set_at: string | null;
  mfa_required: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_signed_in_at: string | null;
}

export type OtpChannel = "email" | "phone";
/**
 * Matches the otp_purpose enum in Postgres. `signin_mfa` is the default
 * sign-in OTP (originally named when OTP was a 2nd factor on top of
 * password — kept for compatibility now that OTP is the primary factor).
 */
export type OtpPurpose =
  | "signin_mfa"
  | "email_verify"
  | "password_reset"
  | "invite_accept"
  | "set_password"
  | "step_up";

export interface CethosSession {
  id: string;
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
}

/**
 * Cookie that carries the TM session id. Per-portal naming
 * (`cethos_session_<portal>`) so vendor + TM + admin can each set their
 * own cookie on `.cethos.com` without one overwriting the other when a
 * user crosses subdomains. See docs/migration/00-overview-federated-sso.md
 * in the admin repo for the full federated-SSO model.
 */
export const SESSION_COOKIE_NAME = "cethos_session_tm";

/** Default session lifetime — 30 days, sliding refresh on each request. */
export const SESSION_TTL_DAYS = 30;

/** OTP code: always 6 digits, ten-minute TTL, five attempts. */
export const OTP_CODE_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
