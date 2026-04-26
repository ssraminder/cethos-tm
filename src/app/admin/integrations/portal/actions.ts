"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { requireRole } from "@/lib/auth/current-user";
import { syncFromPortal } from "@/lib/portal/sync";
import { audit } from "@/lib/auth/audit";

const Schema = z.object({ kind: z.enum(["clients", "vendors", "all"]).default("all") });

export async function syncPortalAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin"]);
  const parsed = Schema.safeParse({ kind: formData.get("kind") || "all" });
  if (!parsed.success) redirect("/admin/integrations/portal?error=invalid+input");

  const result = await syncFromPortal({ triggeredBy: me.id, kind: parsed.data!.kind });

  const h = await headers();
  await audit({
    category: "integration",
    action: "portal_sync",
    actorId: me.id,
    actorEmail: me.email,
    ip: h.get("x-forwarded-for")?.split(",")[0].trim() || null,
    userAgent: h.get("user-agent"),
    meta: { kind: parsed.data!.kind, ...result },
  });

  revalidatePath("/admin/integrations/portal");
  revalidatePath("/admin/projects/new");
  revalidatePath("/admin/projects");
  revalidatePath("/admin/users");

  const params = new URLSearchParams();
  params.set("ca", String(result.clients_added));
  params.set("cu", String(result.clients_updated));
  params.set("va", String(result.vendors_added));
  params.set("vu", String(result.vendors_updated));
  if (result.errors.length > 0) params.set("err", result.errors.slice(0, 3).join(" | "));
  redirect(`/admin/integrations/portal?${params.toString()}`);
}
