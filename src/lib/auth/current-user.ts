import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getSessionUser,
  SESSION_COOKIE_NAME,
  type CethosUser,
  type CethosRole,
} from "@/lib/cethos-auth";

export type CurrentUser = CethosUser;

export async function getCurrentUser(): Promise<CurrentUser> {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) redirect("/sign-in");
  const result = await getSessionUser(sessionId);
  if (!result) redirect("/sign-in");
  return result.user;
}

export async function requireRole(roles: CethosRole[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!roles.includes(user.role as CethosRole)) redirect("/");
  return user;
}
