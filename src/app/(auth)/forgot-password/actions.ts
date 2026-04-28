"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/mailgun";
import { audit } from "@/lib/auth/audit";
import { env } from "@/lib/env";

const Schema = z.object({ email: z.string().email().toLowerCase() });

/**
 * Reset-password flow.
 *
 * Replaces Supabase's built-in resetPasswordForEmail (rate-limited to 3/hr on
 * the free tier and unreliable in production) with admin.generateLink + a
 * Mailgun-delivered email. Mirrors how invites + OTPs are sent everywhere
 * else in TM.
 *
 * Enumeration-safe: we always redirect to the "sent" page regardless of
 * whether the email is registered, so attackers can't probe for valid
 * accounts.
 */
export async function forgotPasswordAction(formData: FormData): Promise<void> {
  const parsed = Schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) redirect("/forgot-password");

  const { email } = parsed.data;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || null;
  const ua = h.get("user-agent") ?? null;

  // Audit the attempt regardless. Tells us whether someone is hammering the
  // endpoint with unknown emails.
  await audit({
    category: "auth",
    action: "password_reset_requested",
    actorEmail: email,
    ip,
    userAgent: ua,
  });

  try {
    // Need the service client to call admin.generateLink.
    const supabase = await getServiceClient();

    // Only generate + send if a profile actually exists. Skip silently
    // otherwise so we don't leak account existence.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, status")
      .eq("email", email)
      .maybeSingle();

    if (
      profile &&
      (profile as { status?: string }).status !== "disabled"
    ) {
      const { data: link, error: linkErr } =
        await supabase.auth.admin.generateLink({
          type: "recovery",
          email,
          options: {
            redirectTo: `${env.appBaseUrl}/reset-password`,
          },
        });

      if (linkErr || !link?.properties?.action_link) {
        // Log but don't surface — keep enumeration safety. The audit row
        // above + console.error gives us the trail.
        console.error(
          `[forgot-password] generateLink failed for ${email}:`,
          linkErr?.message ?? "no action_link returned",
        );
      } else {
        const actionLink = link.properties.action_link;
        const subject = "Reset your Cethos CAT password";
        const text =
          `We received a request to reset your Cethos CAT password.\n\n` +
          `Open this link to set a new password (expires in 60 minutes):\n\n` +
          `${actionLink}\n\n` +
          `If you didn't request this, you can ignore this email — no change has been made to your account.`;
        const html = `
<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0C2340">
  <h1 style="font-size:18px;margin:0 0 16px">Cethos CAT</h1>
  <p style="margin:0 0 12px">We received a request to reset your password.</p>
  <p style="margin:0 0 24px">
    <a href="${actionLink}"
       style="display:inline-block;background:#0E7490;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">
      Set a new password
    </a>
  </p>
  <p style="margin:0 0 8px;color:#64748B;font-size:13px">
    Or copy this link into your browser:<br>
    <a href="${actionLink}" style="color:#0E7490;word-break:break-all">${actionLink}</a>
  </p>
  <p style="margin:24px 0 0;color:#64748B;font-size:13px">
    This link expires in 60 minutes. If you didn't request this, you can ignore this email — no change has been made to your account.
  </p>
</div>`;

        try {
          await sendEmail({ to: email, subject, text, html });
        } catch (mailErr) {
          console.error(
            `[forgot-password] Mailgun send failed for ${email}:`,
            mailErr instanceof Error ? mailErr.message : String(mailErr),
          );
        }
      }
    }
  } catch (e) {
    // Swallow — never reveal a different shape to the client based on whether
    // generation/send succeeded. The audit row + console.error are the trail.
    console.error(
      `[forgot-password] unexpected failure for ${email}:`,
      e instanceof Error ? e.message : String(e),
    );
  }

  // Touch the server client so any session cookies stay live (matches the
  // shape the original implementation had).
  await getServerClient();

  redirect(`/forgot-password?sent=1&email=${encodeURIComponent(email)}`);
}
