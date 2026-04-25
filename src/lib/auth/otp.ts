import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../env";
import { getServiceClient } from "../supabase/server";

const OTP_TTL_MIN = 10;
const OTP_LENGTH = 6;
const OTP_MAX_ATTEMPTS = 5;

export type OtpPurpose = "signin_mfa" | "email_verify" | "password_reset" | "invite_accept";

function generateCode(): string {
  // 6-digit numeric, zero-padded.
  const buf = randomBytes(4);
  const n = buf.readUInt32BE(0) % 10 ** OTP_LENGTH;
  return n.toString().padStart(OTP_LENGTH, "0");
}

function hashCode(code: string, salt: string): string {
  const h = createHmac("sha256", env.appSecret);
  h.update(`${salt}:${code}`);
  return h.digest("hex");
}

export interface IssueOtpInput {
  email: string;
  purpose: OtpPurpose;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export async function issueOtp(input: IssueOtpInput): Promise<{ code: string; otpId: string; expiresAt: Date }> {
  const code = generateCode();
  const salt = randomBytes(16).toString("hex");
  const codeHash = hashCode(code, salt);
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000);

  const supabase = await getServiceClient();

  // Invalidate any outstanding OTPs for this email+purpose
  await supabase
    .from("email_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("email", input.email)
    .eq("purpose", input.purpose)
    .is("consumed_at", null);

  const { data, error } = await supabase
    .from("email_otps")
    .insert({
      email: input.email,
      purpose: input.purpose,
      user_id: input.userId ?? null,
      code_hash: codeHash,
      salt,
      expires_at: expiresAt.toISOString(),
      max_attempts: OTP_MAX_ATTEMPTS,
      ip_address: input.ip ?? null,
      user_agent: input.userAgent ?? null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Failed to issue OTP: ${error?.message ?? "unknown"}`);
  return { code, otpId: data.id, expiresAt };
}

export interface VerifyOtpInput {
  email: string;
  purpose: OtpPurpose;
  code: string;
}

export type VerifyOtpResult =
  | { ok: true; userId: string | null }
  | { ok: false; reason: "not_found" | "expired" | "consumed" | "incorrect" | "locked"; attemptsLeft?: number };

export async function verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
  const supabase = await getServiceClient();
  const { data: rows, error } = await supabase
    .from("email_otps")
    .select("*")
    .eq("email", input.email)
    .eq("purpose", input.purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(`OTP lookup failed: ${error.message}`);
  const otp = rows?.[0];
  if (!otp) return { ok: false, reason: "not_found" };

  if (new Date(otp.expires_at) < new Date()) return { ok: false, reason: "expired" };
  if (otp.attempts >= otp.max_attempts) return { ok: false, reason: "locked" };

  const provided = hashCode(input.code, otp.salt);
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(otp.code_hash, "hex");
  const equal = a.length === b.length && timingSafeEqual(a, b);

  if (!equal) {
    const newAttempts = otp.attempts + 1;
    await supabase.from("email_otps").update({ attempts: newAttempts }).eq("id", otp.id);
    return { ok: false, reason: "incorrect", attemptsLeft: Math.max(0, otp.max_attempts - newAttempts) };
  }

  await supabase.from("email_otps").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);
  return { ok: true, userId: otp.user_id ?? null };
}
