/**
 * @cethos/auth — DIY authentication shared across tm.cethos.com,
 * vendor.cethos.com, and the admin portal. Replaces Supabase Auth
 * once Phase 6 ships.
 *
 * Public surface:
 *   - issueOtp / verifyOtp        (email + phone, six-digit codes)
 *   - createSession / getSession / getSessionUser / revokeSession
 *   - hashPassword / verifyPassword (argon2id)
 *   - getUserBy* / upsertOnSignIn / updatePasswordHash / setPhone
 *   - SESSION_COOKIE_NAME, buildSessionCookie, buildExpiredSessionCookie
 *
 * Phase 1 = additive. None of the existing auth flows call this yet;
 * Phase 2 starts the migration in TM-Cethos.
 */

export * from "./schema";
export * from "./otp";
export * from "./sessions";
export * from "./password";
export * from "./users";
