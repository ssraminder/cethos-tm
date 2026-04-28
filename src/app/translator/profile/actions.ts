"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getServerClient } from "@/lib/supabase/server";
import { audit } from "@/lib/auth/audit";

const Schema = z
  .object({
    password: z.string().min(12, "Password must be at least 12 characters"),
    confirm: z.string().min(12),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
  });

/**
 * Update the signed-in user's password from the /translator/profile page.
 * Same Supabase call as the post-recovery /reset-password flow, but no
 * recovery token — being signed in is enough.
 */
export async function changeProfilePasswordAction(
  formData: FormData,
): Promise<void> {
  const parsed = Schema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    redirect(
      `/translator/profile?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`,
    );
  }

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/translator/profile");

  const { error } = await supabase.auth.updateUser({
    password: parsed.data!.password,
  });
  if (error) {
    redirect(
      `/translator/profile?error=${encodeURIComponent(error.message)}`,
    );
  }

  await audit({
    category: "auth",
    action: "password_changed_from_profile",
    actorId: user!.id,
    actorEmail: user!.email,
  });

  redirect("/translator/profile?saved=1");
}
