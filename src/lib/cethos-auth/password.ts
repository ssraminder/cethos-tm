/**
 * Password handling — argon2id, never plain bcrypt. Optional second factor
 * on top of OTP. The user's password_hash is null until they set one via
 * /account/security (Phase 5 UX).
 *
 * argon2id memory parameter is set conservatively for serverless (64 MiB);
 * tune higher when running on long-lived workers.
 */

import argon2 from "argon2";

const ARGON2_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 1,
};

const MIN_LENGTH = 12;

export interface SetPasswordResult {
  ok: true;
  hash: string;
}

export interface SetPasswordError {
  ok: false;
  error: string;
}

/**
 * Hash a plaintext password. Caller stores the hash in
 * cethos_users.password_hash and stamps password_set_at = now().
 */
export async function hashPassword(plaintext: string): Promise<SetPasswordResult | SetPasswordError> {
  if (typeof plaintext !== "string" || plaintext.length < MIN_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_LENGTH} characters.` };
  }
  if (plaintext.length > 1024) {
    return { ok: false, error: "Password too long." };
  }
  const hash = await argon2.hash(plaintext, ARGON2_OPTS);
  return { ok: true, hash };
}

/**
 * Verify a plaintext password against a stored hash. Returns false on
 * mismatch and on any error (corrupted hash, etc.) without leaking why.
 */
export async function verifyPassword(plaintext: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}

/**
 * Helper for migrations / repl: returns true if a hash exists and is
 * "obviously" an argon2id hash. Useful for skipping double-hashing.
 */
export function looksLikeArgon2Hash(value: string | null): boolean {
  return typeof value === "string" && value.startsWith("$argon2id$");
}
