"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { issueOtp } from "@/lib/auth/otp";
import { sendEmail, renderOtpEmail } from "@/lib/email/mailgun";
import { audit } from "@/lib/auth/audit";

const Schema = z.object({
  email: z.string().email().toLowerCase(),
  next: z.string().optional(),
});

/**
 * OTP-only sign-in (no password).
 *
 * Vendor enters their email. We send a 6-digit code via Mailgun. They enter
 * it on /verify, which validates the OTP, mints a Supabase session via the
 * admin-link path (same pattern as /t/[token]), and lands them on their
 * role's home page.
 *
 * Enumeration-safe: we always redirect to /verify regardless of whether
 * the email is registered. If it isn't, no OTP is issued, no email is
 * sent — the verify step will simply fail with "incorrect code" and they
 * can try again.
 */
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
    const service = await getServiceClient();
    const { data: profile } = await service
      .from("profiles")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();

    if (
      profile &&
      (profile as { status?: string }).status !== "disabled"
    ) {
      const { code } = await issueOtp({
        email,
        purpose: "signin_mfa",
        userId: (profile as { id: string }).id,
        ip,
        userAgent: ua,
      });
      const tpl = renderOtpEmail({
        code,
        purpose: "signin_mfa",
        minutesValid: 10,
      });
      try {
        await sendEmail({
          to: email,
          subject: tpl.subject,
          text: tpl.text,
          html: tpl.html,
        });
      } catch (mailErr) {
        console.error(
          `[sign-in] OTP email send failed for ${email}:`,
          mailErr instanceof Error ? mailErr.message : String(mailErr),
        );
      }
    }
  } catch (e) {
    console.error(
      `[sign-in] unexpected failure for ${email}:`,
      e instanceof Error ? e.message : String(e),
    );
  }

  // Always redirect to /verify with the email pre-populated. Enumeration
  // attackers can't tell whether an OTP was actually sent.
  const target = `/verify?email=${encodeURIComponent(email)}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
  redirect(target);
}

/**
 * Sign-out works the same as before — clear Supabase session + MFA cookie.
 */
export async function signOutAction(): Promise<void> {
  const { getServerClient } = await import("@/lib/supabase/server");
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  if (user) {
    await audit({ category: "auth", action: "sign_out", actorId: user.id, actorEmail: user.email });
  }
  const { clearMfaCookie } = await import("@/lib/auth/mfa-cookie");
  await clearMfaCookie();
  redirect("/sign-in");
}
