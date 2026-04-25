"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import { verifyOtp, issueOtp } from "@/lib/auth/otp";
import { sendEmail, renderOtpEmail } from "@/lib/email/mailgun";
import { issueMfaCookie } from "@/lib/auth/mfa-cookie";
import { audit } from "@/lib/auth/audit";

const VerifySchema = z.object({
  email: z.string().email().toLowerCase(),
  code: z.string().regex(/^\d{6}$/),
  next: z.string().optional(),
});

const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  pm: "/pm",
  translator: "/translator",
  reviewer: "/translator",
};

export async function verifyAction(formData: FormData): Promise<void> {
  const parsed = VerifySchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    next: formData.get("next") ?? "",
  });
  if (!parsed.success) {
    redirect(`/verify?error=${encodeURIComponent("Enter the 6-digit code.")}`);
  }
  const { email, code, next } = parsed.data;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || null;
  const ua = h.get("user-agent") ?? null;

  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || (user.email?.toLowerCase() ?? "") !== email) {
    redirect(`/sign-in?error=${encodeURIComponent("Session expired. Please sign in again.")}`);
  }

  const result = await verifyOtp({ email, code, purpose: "signin_mfa" });
  if (!result.ok) {
    const reasonText: Record<string, string> = {
      not_found: "No active code. Request a new one.",
      expired: "Code expired. Request a new one.",
      consumed: "Code already used. Request a new one.",
      incorrect: `Incorrect code. ${result.attemptsLeft ?? 0} attempts remaining.`,
      locked: "Too many attempts. Request a new code.",
    };
    await audit({ category: "auth", action: "otp_failed", actorId: user!.id, actorEmail: email, ip, userAgent: ua, meta: { reason: result.reason } });
    redirect(`/verify?email=${encodeURIComponent(email)}&error=${encodeURIComponent(reasonText[result.reason])}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  }

  // Mint MFA cookie.
  await issueMfaCookie(user!.id, email);

  // Update last_sign_in_at and read role.
  const service = await getServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .update({ last_sign_in_at: new Date().toISOString() })
    .eq("id", user!.id)
    .select("role")
    .single();

  await audit({ category: "auth", action: "sign_in_completed", actorId: user!.id, actorEmail: email, ip, userAgent: ua });

  const home = ROLE_HOME[profile?.role ?? "translator"] ?? "/translator";
  redirect(next || home);
}

export async function resendAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").toLowerCase();
  if (!email) redirect("/sign-in");

  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email?.toLowerCase() !== email) {
    redirect("/sign-in");
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || null;
  const ua = h.get("user-agent") ?? null;

  const { code } = await issueOtp({ email, purpose: "signin_mfa", userId: user!.id, ip, userAgent: ua });
  const msg = renderOtpEmail({ code, purpose: "signin_mfa", minutesValid: 10 });
  await sendEmail({ to: email, subject: msg.subject, text: msg.text, html: msg.html });
  await audit({ category: "auth", action: "otp_resent", actorId: user!.id, actorEmail: email, ip, userAgent: ua });

  redirect(`/verify?email=${encodeURIComponent(email)}&resent=1`);
}
