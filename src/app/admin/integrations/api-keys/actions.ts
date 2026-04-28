"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/current-user";
import { mintApiKey } from "@/lib/api-keys";
import { getServiceClient } from "@/lib/supabase/server";
import { audit } from "@/lib/auth/audit";

const MintSchema = z.object({
  name: z.string().min(1).max(120),
  scope: z.enum(["tms_ingest", "webhook_callback", "test_provisioning"]),
});

export async function mintApiKeyAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin"]);
  const parsed = MintSchema.safeParse({
    name: formData.get("name"),
    scope: formData.get("scope"),
  });
  if (!parsed.success) redirect(`/admin/integrations/api-keys?error=${encodeURIComponent("Invalid input")}`);

  let minted;
  try {
    minted = await mintApiKey({
      name: parsed.data!.name,
      scope: parsed.data!.scope,
      created_by: me.id,
    });
  } catch (e) {
    redirect(`/admin/integrations/api-keys?error=${encodeURIComponent(e instanceof Error ? e.message : "Mint failed")}`);
  }

  await audit({
    category: "integration",
    action: "api_key_minted",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "api_key",
    targetId: minted!.id,
    meta: { name: parsed.data!.name, scope: parsed.data!.scope, prefix: minted!.prefix },
  });

  revalidatePath("/admin/integrations/api-keys");
  redirect(`/admin/integrations/api-keys?minted=${encodeURIComponent(minted!.plaintext)}`);
}

export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin"]);
  const key_id = String(formData.get("key_id") ?? "");
  if (!key_id) redirect("/admin/integrations/api-keys");
  const supabase = await getServiceClient();
  await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", key_id);
  await audit({
    category: "integration",
    action: "api_key_revoked",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "api_key",
    targetId: key_id,
  });
  revalidatePath("/admin/integrations/api-keys");
  redirect("/admin/integrations/api-keys");
}
