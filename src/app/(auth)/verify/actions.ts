"use server";

import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { z } from "zod";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { getServiceClient } from "@/lib/supabase/server";
import { verifyOtp, issueOtp } from "@/lib/auth/otp";
import { sendEmail, renderOtpEmail } from "@/lib/email/mailgun";
import { issueMfaCookie } from "@/lib/auth/mfa-cookie";
import { audit } from "@/lib/auth/audit";
import { env } from "@/lib/env";

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

/**
 * OTP verification + Supabase session minting.
 *
 * In the OTP-only sign-in flow, /verify is the *only* place a Supabase
 * session gets established. After our internal-OTP check passes, we use
 * the same admin.generateLink + verifyOtp pattern as /t/[token] to mint
 * the Supabase session. No password ever exchanged.
 */
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

  // 1. Validate the internal-OTP code.
  const result = await verifyOtp({ email, code, purpose: "signin_mfa" });
  if (!result.ok) {
    const reasonText: Record<string, string> = {
      not_found: "No active code. Request a new one.",
      expired: "Code expired. Request a new one.",
      consumed: "Code already used. Request a new one.",
      incorrect: `Incorrect code. ${result.attemptsLeft ?? 0} attempts remaining.`,
      locked: "Too many attempts. Request a new code.",
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
      `/verify?email=${encodeURIComponent(email)}&error=${encodeURIComponent(reasonText[result.reason])}${next ? `&next=${encodeURIComponent(next)}` : ""}`,
    );
  }

  // 2. Look up profile (need id + role for routing + last_sign_in_at update).
  const service = await getServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id, email, role, status")
    .eq("email", email)
    .maybeSingle();

  if (!profile) {
    // OTP was valid but no profile — should not happen unless someone
    // hand-issued an OTP. Treat as a corrupt state.
    redirect(
      `/sign-in?error=${encodeURIComponent("Account not provisioned. Contact your administrator.")}`,
    );
  }
  const p = profile as {
    id: string;
    email: string;
    role: string;
    status: string;
  };

  if (p.status !== "active") {
    const msg =
      p.status === "suspended"
        ? "Your account is suspended."
        : "Your account is pending activation.";
    redirect(`/sign-in?error=${encodeURIComponent(msg)}`);
  }

  // 3. Mint a Supabase session for this user via the admin-link path.
  //    Same pattern as /t/[token]: generateLink returns a hashed_token; SSR
  //    client's verifyOtp(hashed_token) creates the session and writes
  //    cookies onto our cookie store.
  const cookieStore = await cookies();
  const cookieMethods: CookieMethodsServer = {
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) => {
      for (const c of toSet) {
        try {
          cookieStore.set({ name: c.name, value: c.value, ...c.options });
        } catch {
          // Server-actions can't always write cookies post-redirect; the
          // SSR client retries via setAll which we wire up below.
        }
      }
    },
  };
  const ssrClient = createServerClient(
    env.supabaseUrl,
    env.supabasePublishableKey,
    { cookies: cookieMethods },
  );

  const { data: link, error: linkErr } =
    await service.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
  const hashedToken = link?.properties?.hashed_token;
  if (linkErr || !hashedToken) {
    console.error(
      "[verify] admin.generateLink failed:",
      linkErr?.message ?? "no hashed_token",
    );
    redirect(
      `/sign-in?error=${encodeURIComponent("Could not establish session. Please try again.")}`,
    );
  }

  const { error: verifyErr } = await ssrClient.auth.verifyOtp({
    type: "magiclink",
    token_hash: hashedToken,
  });
  if (verifyErr) {
    console.error("[verify] verifyOtp failed:", verifyErr.message);
    redirect(
      `/sign-in?error=${encodeURIComponent("Could not establish session. Please try again.")}`,
    );
  }

  // 4. Set the MFA cookie. With OTP-only auth there's no separate "first
  //    factor passed" state — completing the OTP IS the auth — but the proxy
  //    middleware still checks for this cookie before allowing /admin /pm
  //    /translator. Issue it now.
  await issueMfaCookie(p.id, email);

  // 5. Update last_sign_in_at, audit, route to role home.
  await service
    .from("profiles")
    .update({ last_sign_in_at: new Date().toISOString() })
    .eq("id", p.id);

  await audit({
    category: "auth",
    action: "sign_in_completed",
    actorId: p.id,
    actorEmail: email,
    ip,
    userAgent: ua,
  });

  const home = ROLE_HOME[p.role] ?? "/translator";
  redirect(next || home);
}

/**
 * Resend the OTP. No Supabase session needed — we look up the profile by
 * email and reissue.
 */
export async function resendAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").toLowerCase();
  if (!email) redirect("/sign-in");

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || null;
  const ua = h.get("user-agent") ?? null;

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
      await sendEmail({
        to: email,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
      });
      await audit({
        category: "auth",
        action: "otp_resent",
        actorId: (profile as { id: string }).id,
        actorEmail: email,
        ip,
        userAgent: ua,
      });
    }
  } catch (e) {
    console.error(
      `[verify] resend failed for ${email}:`,
      e instanceof Error ? e.message : String(e),
    );
  }

  redirect(`/verify?email=${encodeURIComponent(email)}&resent=1`);
}
