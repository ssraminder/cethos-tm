"use server";

import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { z } from "zod";
import {
  verifyOtp,
  issueOtp,
  upsertOnSignIn,
  createSession,
  buildSessionCookie,
} from "@/lib/cethos-auth";
import { sendEmail, renderOtpEmail } from "@/lib/email/mailgun";
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
  vendor: "/translator",
};

export async function verifyAction(formData: FormData): Promise<void> {
  const parsed = VerifySchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    next: formData.get("next") ?? "",
  });
  if (!parsed.success) {
    const email = String(formData.get("email") ?? "");
    redirect(
      `/verify?email=${encodeURIComponent(email)}&error=${encodeURIComponent("Enter the 6-digit code.")}`,
    );
  }
  const { email, code, next } = parsed.data!;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || null;
  const ua = h.get("user-agent") ?? null;

  // 1. Validate the OTP.
  const result = await verifyOtp({ channel: "email", recipient: email, code, purpose: "signin_mfa" });
  if (!result.ok) {
    const reasonText: Record<string, string> = {
      no_active_code: "No active code. Request a new one.",
      expired: "Code expired. Request a new one.",
      wrong_code: "Incorrect code.",
      exhausted: "Too many attempts. Request a new code.",
    };
    await audit({
      category: "auth",
      action: "otp_failed",
      actorEmail: email,
      ip,
      userAgent: ua,
      meta: { reason: result.reason },
    });
    redirect(
      `/verify?email=${encodeURIComponent(email)}&error=${encodeURIComponent(reasonText[result.reason] ?? "Verification failed.")}${next ? `&next=${encodeURIComponent(next)}` : ""}`,
    );
  }

  // 2. Find-or-create cethos_user.
  const user = await upsertOnSignIn({ email });

  if (!user.is_active) {
    redirect(`/sign-in?error=${encodeURIComponent("Your account is inactive. Contact your administrator.")}`);
  }

  // 3. Create a cethos session.
  const session = await createSession({ user_id: user.id, ip_address: ip, user_agent: ua });

  // 4. Set the session cookie.
  const cookieAttrs = buildSessionCookie(session.id);
  const store = await cookies();
  store.set(cookieAttrs.name, cookieAttrs.value, {
    httpOnly: cookieAttrs.httpOnly,
    secure: cookieAttrs.secure,
    sameSite: cookieAttrs.sameSite,
    path: cookieAttrs.path,
    domain: cookieAttrs.domain,
    maxAge: cookieAttrs.maxAge,
  });

  await audit({
    category: "auth",
    action: "sign_in_completed",
    actorId: user.id,
    actorEmail: email,
    ip,
    userAgent: ua,
  });

  const home = ROLE_HOME[user.role] ?? "/translator";
  redirect(next || home);
}

export async function resendAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").toLowerCase();
  if (!email) redirect("/sign-in");

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || null;
  const ua = h.get("user-agent") ?? null;

  try {
    const { code } = await issueOtp({
      channel: "email",
      recipient: email,
      purpose: "signin_mfa",
      ip_address: ip,
      user_agent: ua,
    });
    const tpl = renderOtpEmail({ code, purpose: "signin_mfa", minutesValid: 10 });
    await sendEmail({ to: email, subject: tpl.subject, text: tpl.text, html: tpl.html });
    await audit({ category: "auth", action: "otp_resent", actorEmail: email, ip, userAgent: ua });
  } catch (e) {
    console.error(
      `[verify] resend failed for ${email}:`,
      e instanceof Error ? e.message : String(e),
    );
  }

  redirect(`/verify?email=${encodeURIComponent(email)}&resent=1`);
}
