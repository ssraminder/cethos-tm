"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { issueOtp } from "@/lib/auth/otp";
import { sendEmail, renderOtpEmail } from "@/lib/email/mailgun";
import { audit } from "@/lib/auth/audit";

const Schema = z.object({
  token: z.string().min(10),
  full_name: z.string().min(1).max(120),
  password: z.string().min(12).max(256),
  terms: z.string().optional(),
});

export async function acceptInviteAction(formData: FormData): Promise<void> {
  const parsed = Schema.safeParse({
    token: formData.get("token"),
    full_name: formData.get("full_name"),
    password: formData.get("password"),
    terms: formData.get("terms"),
  });
  if (!parsed.success) redirect(`/invite/${formData.get("token")}?error=${encodeURIComponent("Please complete all fields.")}`);
  if (!parsed.data!.terms) redirect(`/invite/${parsed.data!.token}?error=${encodeURIComponent("You must accept the terms.")}`);

  const { token, full_name, password } = parsed.data!;
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const supabase = await getServiceClient();
  const { data: invite } = await supabase
    .from("invitations")
    .select("id, email, role, expires_at, accepted_at, revoked_at, invited_by")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!invite || invite.accepted_at || invite.revoked_at || new Date(invite.expires_at) < new Date()) {
    redirect(`/sign-in?error=${encodeURIComponent("Invitation invalid or expired.")}`);
  }

  // Create the auth user.
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: invite!.email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role: invite!.role },
    app_metadata: { role: invite!.role, auth_source: "email" },
  });
  if (createErr || !created.user) {
    redirect(`/invite/${token}?error=${encodeURIComponent(createErr?.message ?? "Could not create account.")}`);
  }

  await supabase.from("profiles").insert({
    id: created!.user.id,
    email: invite!.email,
    full_name,
    role: invite!.role,
    status: "active",
    auth_source: "email",
    invited_by: invite!.invited_by,
    invited_at: new Date().toISOString(),
    mfa_required: true,
  });

  await supabase.from("invitations").update({
    accepted_at: new Date().toISOString(),
    accepted_user: created!.user.id,
  }).eq("id", invite!.id);

  // Issue OTP for first sign-in.
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || null;
  const ua = h.get("user-agent") ?? null;
  const { code } = await issueOtp({ email: invite!.email, purpose: "signin_mfa", userId: created!.user.id, ip, userAgent: ua });
  const msg = renderOtpEmail({ code, purpose: "signin_mfa", minutesValid: 10 });
  await sendEmail({ to: invite!.email, subject: msg.subject, text: msg.text, html: msg.html });

  await audit({ category: "user", action: "invite_accepted", actorId: created!.user.id, actorEmail: invite!.email, ip, userAgent: ua });

  redirect(`/sign-in?email=${encodeURIComponent(invite!.email)}`);
}
