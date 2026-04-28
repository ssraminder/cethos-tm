"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getServerClient } from "@/lib/supabase/server";
import { audit } from "@/lib/auth/audit";

const Schema = z
  .object({ password: z.string().min(12), confirm: z.string().min(12) })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match" });

export async function resetPasswordAction(formData: FormData): Promise<void> {
  const parsed = Schema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    redirect(`/reset-password?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  }
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { error } = await supabase.auth.updateUser({ password: parsed.data!.password });
  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }
  await audit({ category: "auth", action: "password_changed", actorId: user!.id, actorEmail: user!.email });
  // Use ?info= (not ?error=) so /sign-in renders this in the green
  // success chip instead of the rose error chip.
  redirect("/sign-in?info=" + encodeURIComponent("Password updated. Sign in with your new password."));
}
