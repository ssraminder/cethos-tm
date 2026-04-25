import { redirect } from "next/navigation";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "pm" | "translator" | "reviewer";
  status: "pending" | "active" | "suspended";
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const service = await getServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id, email, full_name, role, status")
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile) redirect("/sign-in");
  return profile as CurrentUser;
}

export async function requireRole(roles: Array<CurrentUser["role"]>): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}
