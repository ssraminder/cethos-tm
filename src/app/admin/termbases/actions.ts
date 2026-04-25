"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import { audit } from "@/lib/auth/audit";
import { parseTbx } from "@/lib/tbx/parse";

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  scope: z.enum(["global", "client", "project", "job"]).default("client"),
  client_id: z.string().uuid().optional().or(z.literal("")),
  languages: z.string().min(2),
});

export async function createTermbaseAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin"]);
  const parsed = CreateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    scope: formData.get("scope") || "client",
    client_id: formData.get("client_id") || "",
    languages: formData.get("languages"),
  });
  if (!parsed.success) {
    redirect(`/admin/termbases/new?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  }
  const { name, description, scope, client_id, languages } = parsed.data!;
  const langArr = languages.split(/[,\s]+/).filter(Boolean);

  const supabase = await getServiceClient();
  const { data: tb, error } = await supabase
    .from("termbases")
    .insert({
      name,
      description: description ?? null,
      scope,
      client_id: client_id || null,
      languages: langArr,
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error || !tb) {
    redirect(`/admin/termbases/new?error=${encodeURIComponent(error?.message ?? "Failed to create termbase")}`);
  }

  await audit({
    category: "termbase",
    action: "termbase_created",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "termbase",
    targetId: tb!.id,
    meta: { name, languages: langArr, scope },
  });
  redirect(`/admin/termbases/${tb!.id}`);
}

export async function importTbxAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin"]);
  const tb_id = String(formData.get("tb_id") ?? "");
  if (!tb_id) redirect(`/admin/termbases`);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/admin/termbases/${tb_id}?error=${encodeURIComponent("Choose a TBX file.")}`);
  }
  if (file!.size > 50 * 1024 * 1024) {
    redirect(`/admin/termbases/${tb_id}?error=${encodeURIComponent("TBX too large (max 50 MB).")}`);
  }

  const supabase = await getServiceClient();
  let parsed;
  try {
    const buf = Buffer.from(await file!.arrayBuffer());
    parsed = parseTbx(buf);
  } catch (e) {
    redirect(`/admin/termbases/${tb_id}?error=${encodeURIComponent(e instanceof Error ? e.message : "Parse failed")}`);
  }

  let conceptsAdded = 0;
  let entriesAdded = 0;
  for (const c of parsed!.concepts) {
    const { data: concept } = await supabase
      .from("term_concepts")
      .insert({ termbase_id: tb_id, domain: c.domain ?? null, definition: c.definition ?? null })
      .select("id")
      .single();
    if (!concept) continue;
    conceptsAdded++;
    const rows = c.terms.map((t) => ({
      concept_id: concept.id,
      language: t.language,
      term: t.term,
      part_of_speech: t.part_of_speech ?? null,
      usage_example: t.usage_example ?? null,
      status: (t.status as "approved" | "pending" | "forbidden") ?? "approved",
    }));
    if (rows.length > 0) {
      const { error: entErr } = await supabase.from("term_entries").insert(rows);
      if (!entErr) entriesAdded += rows.length;
    }
  }

  // Add any newly seen languages to the termbase's languages array.
  const { data: tbRow } = await supabase.from("termbases").select("languages").eq("id", tb_id).maybeSingle();
  if (tbRow) {
    const merged = Array.from(new Set([...(tbRow.languages ?? []), ...parsed!.languages]));
    await supabase.from("termbases").update({ languages: merged }).eq("id", tb_id);
  }

  const h = await headers();
  await audit({
    category: "termbase",
    action: "tbx_imported",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "termbase",
    targetId: tb_id,
    ip: h.get("x-forwarded-for")?.split(",")[0].trim() || null,
    userAgent: h.get("user-agent") ?? null,
    meta: { filename: file!.name, concepts: conceptsAdded, entries: entriesAdded, languages: parsed!.languages },
  });
  revalidatePath(`/admin/termbases/${tb_id}`);
  redirect(`/admin/termbases/${tb_id}?imported=${entriesAdded}&concepts=${conceptsAdded}`);
}

export async function attachTermbaseToJobAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "pm"]);
  const job_id = String(formData.get("job_id") ?? "");
  const tb_id = String(formData.get("tb_id") ?? "");
  const priority = Number(formData.get("priority") ?? 100);
  if (!job_id || !tb_id) redirect("/pm/jobs");

  const supabase = await getServiceClient();
  await supabase.from("job_resources").upsert(
    { job_id, resource_type: "termbase", resource_id: tb_id, priority },
    { onConflict: "job_id,resource_type,resource_id" }
  );
  await audit({ category: "job", action: "termbase_attached", actorId: me.id, actorEmail: me.email, targetType: "job", targetId: job_id, meta: { tb_id } });
  revalidatePath(`/pm/jobs/${job_id}`);
  redirect(`/pm/jobs/${job_id}`);
}

export async function detachTermbaseFromJobAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "pm"]);
  const job_id = String(formData.get("job_id") ?? "");
  const tb_id = String(formData.get("tb_id") ?? "");
  if (!job_id || !tb_id) redirect("/pm/jobs");
  const supabase = await getServiceClient();
  await supabase.from("job_resources").delete()
    .eq("job_id", job_id).eq("resource_type", "termbase").eq("resource_id", tb_id);
  await audit({ category: "job", action: "termbase_detached", actorId: me.id, actorEmail: me.email, targetType: "job", targetId: job_id, meta: { tb_id } });
  revalidatePath(`/pm/jobs/${job_id}`);
  redirect(`/pm/jobs/${job_id}`);
}
