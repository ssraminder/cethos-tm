/**
 * OTP send + verify, channel-agnostic. Uses email_otps for email and
 * phone_otps for phone — same contract, different channel.
 *
 * Codes are 6 random digits, hashed with HMAC-SHA256(salt) before
 * storage so a DB leak doesn't expose live codes. We compare via
 * timingSafeEqual to neutralise timing oracles.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getServiceClient } from "@/lib/supabase/server";
import {
  OTP_CODE_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MINUTES,
  type OtpChannel,
  type OtpPurpose,
} from "./schema";

function randomDigits(n: number): string {
  // crypto.randomBytes → digit string. Avoids Math.random.
  const bytes = randomBytes(n);
  let out = "";
  for (let i = 0; i < n; i++) out += String(bytes[i] % 10);
  return out;
}

function randomSalt(): string {
  return randomBytes(16).toString("hex");
}

function hashCode(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export interface IssueOtpInput {
  channel: OtpChannel;
  /** email address for email channel, E.164 phone for phone channel */
  recipient: string;
  user_id?: string | null;
  purpose?: OtpPurpose;
  ip_address?: string | null;
  user_agent?: string | null;
}

export interface IssueOtpResult {
  /** Plaintext code to deliver via Mailgun/Twilio. Never store. */
  code: string;
  /** OTP row id for logging/auditing. */
  otp_id: string;
  expires_at: string;
}

/**
 * Mint a new OTP and store its hash. The caller (a send_email_otp /
 * send_phone_otp action) is responsible for actually delivering the
 * `code` over the channel.
 */
export async function issueOtp(input: IssueOtpInput): Promise<IssueOtpResult> {
  const supabase = await getServiceClient();
  const code = randomDigits(OTP_CODE_LENGTH);
  const salt = randomSalt();
  const code_hash = hashCode(code, salt);
  const expires_at = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  const purpose: OtpPurpose = input.purpose ?? "signin_mfa";
  const table = input.channel === "email" ? "email_otps" : "phone_otps";
  const recipientField = input.channel === "email" ? "email" : "phone";

  const { data, error } = await supabase
    .from(table)
    .insert({
      user_id: input.user_id ?? null,
      [recipientField]: input.recipient,
      purpose,
      code_hash,
      salt,
      expires_at,
      max_attempts: OTP_MAX_ATTEMPTS,
      ip_address: input.ip_address ?? null,
      user_agent: input.user_agent ?? null,
    })
    .select("id, expires_at")
    .single();

  if (error || !data) {
    throw new Error(`OTP insert failed: ${error?.message ?? "unknown"}`);
  }

  return { code, otp_id: data.id as string, expires_at: data.expires_at as string };
}

export interface VerifyOtpInput {
  channel: OtpChannel;
  recipient: string;
  code: string;
  purpose?: OtpPurpose;
}

export type VerifyOtpResult =
  | { ok: true; otp_id: string; user_id: string | null }
  | { ok: false; reason: "no_active_code" | "expired" | "wrong_code" | "exhausted" };

/**
 * Verify a code. Consumes the OTP on success so it can't be replayed.
 * Increments `attempts` on a wrong code; once max_attempts is hit the
 * row is dead even if the user later guesses correctly.
 */
export async function verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
  const supabase = await getServiceClient();
  const purpose: OtpPurpose = input.purpose ?? "signin_mfa";
  const table = input.channel === "email" ? "email_otps" : "phone_otps";
  const recipientField = input.channel === "email" ? "email" : "phone";

  // Find the latest unconsumed, unexpired OTP for this recipient + purpose.
  const { data: rows } = await supabase
    .from(table)
    .select("id, code_hash, salt, expires_at, attempts, max_attempts, user_id, consumed_at")
    .eq(recipientField, input.recipient)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  const row = rows?.[0] as
    | {
        id: string;
        code_hash: string;
        salt: string;
        expires_at: string;
        attempts: number;
        max_attempts: number;
        user_id: string | null;
        consumed_at: string | null;
      }
    | undefined;

  if (!row) return { ok: false, reason: "no_active_code" };
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (row.attempts >= row.max_attempts) {
    return { ok: false, reason: "exhausted" };
  }

  const expectedHash = hashCode(input.code, row.salt);
  if (!constantTimeEquals(expectedHash, row.code_hash)) {
    await supabase
      .from(table)
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    return { ok: false, reason: "wrong_code" };
  }

  // Success — burn the code.
  await supabase
    .from(table)
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);

  return { ok: true, otp_id: row.id, user_id: row.user_id };
}
