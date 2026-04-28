"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import { issueOtp } from "@/lib/auth/otp";
import { sendEmail, renderOtpEmail } from "@/lib/email/mailgun";
import { audit } from "@/lib/auth/audit";

const Schema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1).max(256),
  next: z.string().optional(),
});

export async function signInAction(formData: FormData): Promise<void> {
  const parsed = Schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? "",
  });
  if (!parsed.success) {
    redirect(`/sign-in?error=${encodeURIComponent("Invalid email or password.")}`);
  }
  const { email, password, next } = parsed.data;

  const supabase = await getServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || null;
  const ua = h.get("user-agent") ?? null;

  if (error || !data.user) {
    await audit({ category: "auth", action: "sign_in_failed", actorEmail: email, ip, userAgent: ua, meta: { reason: error?.message } });
    redirect(`/sign-in?error=${encodeURIComponent("Invalid email or password.")}&email=${encodeURIComponent(email)}`);
  }

  // Lookup profile to confirm status / MFA requirement.
  const service = await getServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id, status, mfa_required, role")
    .eq("id", data!.user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    await audit({ category: "auth", action: "sign_in_no_profile", actorEmail: email, ip, userAgent: ua });
    redirect(`/sign-in?error=${encodeURIComponent("Account not provisioned. Contact your administrator.")}`);
  }

  if (profile!.status !== "active") {
    await supabase.auth.signOut();
    await audit({ category: "auth", action: "sign_in_blocked_status", actorId: profile!.id, actorEmail: email, ip, userAgent: ua, meta: { status: profile!.status } });
    const msg = profile!.status === "suspended" ? "Your account is suspended." : "Your account is pending activation.";
    redirect(`/sign-in?error=${encodeURIComponent(msg)}`);
  }

  // MFA gate. Disposable test accounts (test_provisioning auth_source) have
  // mfa_required=false and cannot receive OTPs at their @cethos.test address,
  // so they sign in directly. Real users (mfa_required=true on the profile)
  // continue through the OTP/verify flow.
  if (profile!.mfa_required === false) {
    // Set the MFA cookie so /translator + /admin etc. don't bounce them back
    // to /verify.
    const { setMfaCookie } = await import("@/lib/auth/mfa-cookie");
    await setMfaCookie(profile!.id);
    await audit({
      category: "auth",
      action: "sign_in_mfa_skipped",
      actorId: profile!.id,
      actorEmail: email,
      ip,
      userAgent: ua,
    });
    const target = next && next.startsWith("/") ? next : "/translator";
    redirect(target);
  }

  // Issue OTP and send email (real users with mfa_required=true).
  const { code } = await issueOtp({ email, purpose: "signin_mfa", userId: profile!.id, ip, userAgent: ua });
  const msg = renderOtpEmail({ code, purpose: "signin_mfa", minutesValid: 10 });
  await sendEmail({ to: email, subject: msg.subject, text: msg.text, html: msg.html });
  await audit({ category: "auth", action: "otp_issued", actorId: profile!.id, actorEmail: email, ip, userAgent: ua, meta: { purpose: "signin_mfa" } });

  const target = `/verify?email=${encodeURIComponent(email)}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
  redirect(target);
}

export async function signOutAction(): Promise<void> {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  if (user) {
    await audit({ category: "auth", action: "sign_out", actorId: user.id, actorEmail: user.email });
  }
  // Clear MFA cookie too
  const { clearMfaCookie } = await import("@/lib/auth/mfa-cookie");
  await clearMfaCookie();
  redirect("/sign-in");
}
