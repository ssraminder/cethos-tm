"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { getServerClient } from "@/lib/supabase/server";
import { audit } from "@/lib/auth/audit";
import { env } from "@/lib/env";

const Schema = z.object({ email: z.string().email().toLowerCase() });

export async function forgotPasswordAction(formData: FormData): Promise<void> {
  const parsed = Schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) redirect("/forgot-password");

  const { email } = parsed.data;
  const supabase = await getServerClient();
  // Supabase sends its own reset email; we'll customize the template later via Mailgun if needed.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${env.appBaseUrl}/reset-password`,
  });

  const h = await headers();
  await audit({
    category: "auth",
    action: "password_reset_requested",
    actorEmail: email,
    ip: h.get("x-forwarded-for")?.split(",")[0].trim() || null,
    userAgent: h.get("user-agent") ?? null,
  });

  redirect(`/forgot-password?sent=1&email=${encodeURIComponent(email)}`);
}
