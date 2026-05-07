"use server";

import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { z } from "zod";
import {
  issueOtp,
  revokeSession,
  buildExpiredSessionCookie,
  SESSION_COOKIE_NAME,
} from "@/lib/cethos-auth";
import { sendEmail, renderOtpEmail } from "@/lib/email/mailgun";
import { audit } from "@/lib/auth/audit";

const Schema = z.object({
  email: z.string().email().toLowerCase(),
  next: z.string().optional(),
});

export async function signInAction(formData: FormData): Promise<void> {
  const parsed = Schema.safeParse({
    email: formData.get("email"),
    next: formData.get("next") ?? "",
  });
  if (!parsed.success) {
    redirect(`/sign-in?error=${encodeURIComponent("Enter a valid email address.")}`);
  }
  const { email, next } = parsed.data!;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || null;
  const ua = h.get("user-agent") ?? null;

  await audit({
    category: "auth",
    action: "sign_in_email_submitted",
    actorEmail: email,
    ip,
    userAgent: ua,
  });

  try {
    const { code } = await issueOtp({
      channel: "email",
      recipient: email,
      purpose: "signin_mfa",
      ip_address: ip,
      user_agent: ua,
    });
    const tpl = renderOtpEmail({ code, purpose: "signin_mfa", minutesValid: 10 });
    try {
      await sendEmail({ to: email, subject: tpl.subject, text: tpl.text, html: tpl.html });
    } catch (mailErr) {
      console.error(
        `[sign-in] OTP email send failed for ${email}:`,
        mailErr instanceof Error ? mailErr.message : String(mailErr),
      );
    }
  } catch (e) {
    console.error(
      `[sign-in] unexpected failure for ${email}:`,
      e instanceof Error ? e.message : String(e),
    );
  }

  const target = `/verify?email=${encodeURIComponent(email)}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
  redirect(target);
}

export async function signOutAction(): Promise<void> {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    try {
      await revokeSession(sessionId);
    } catch (e) {
      console.error("[sign-out] revokeSession failed:", e instanceof Error ? e.message : String(e));
    }
  }

  const expired = buildExpiredSessionCookie();
  store.set(expired.name, expired.value, {
    httpOnly: expired.httpOnly,
    secure: expired.secure,
    sameSite: expired.sameSite,
    path: expired.path,
    domain: expired.domain,
    maxAge: expired.maxAge,
  });

  await audit({ category: "auth", action: "sign_out", meta: { sessionId } });
  redirect("/sign-in");
}
