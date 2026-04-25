"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import { audit } from "@/lib/auth/audit";
import { parseTmx } from "@/lib/tmx/parse";

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  source_lang: z.string().min(2).max(10),
  target_lang: z.string().min(2).max(10),
  scope: z.enum(["global", "client", "project", "job"]).default("client"),
  client_id: z.string().uuid().optional().or(z.literal("")),
});

export async function createTmAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin"]);
  const parsed = CreateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    source_lang: formData.get("source_lang"),
    target_lang: formData.get("target_lang"),
    scope: formData.get("scope") || "client",
    client_id: formData.get("client_id") || "",
  });
  if (!parsed.success) {
    redirect(`/admin/tm/new?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  }
  const { name, description, source_lang, target_lang, scope, client_id } = parsed.data!;
  if (source_lang === target_lang) {
    redirect(`/admin/tm/new?error=${encodeURIComponent("Source and target languages must differ.")}`);
  }

  const supabase = await getServiceClient();
  const { data: tm, error } = await supabase
    .from("translation_memories")
    .insert({
      name,
      description: description ?? null,
      source_lang,
      target_lang,
      scope,
      client_id: client_id || null,
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error || !tm) {
    redirect(`/admin/tm/new?error=${encodeURIComponent(error?.message ?? "Failed to create TM")}`);
  }

  const h = await headers();
  await audit({
    category: "tm",
    action: "tm_created",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "tm",
    targetId: tm!.id,
    ip: h.get("x-forwarded-for")?.split(",")[0].trim() || null,
    userAgent: h.get("user-agent") ?? null,
    meta: { name, source_lang, target_lang, scope },
  });

  redirect(`/admin/tm/${tm!.id}`);
}

const ImportSchema = z.object({ tm_id: z.string().uuid() });

export async function importTmxAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin"]);
  const parsed = ImportSchema.safeParse({ tm_id: formData.get("tm_id") });
  if (!parsed.success) redirect(`/admin/tm`);
  const { tm_id } = parsed.data!;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/admin/tm/${tm_id}?error=${encodeURIComponent("Choose a TMX file to upload.")}`);
  }
  if (file!.size > 100 * 1024 * 1024) {
    redirect(`/admin/tm/${tm_id}?error=${encodeURIComponent("TMX too large (max 100 MB).")}`);
  }

  const supabase = await getServiceClient();
  const { data: tm } = await supabase
    .from("translation_memories")
    .select("id, source_lang, target_lang")
    .eq("id", tm_id)
    .maybeSingle();
  if (!tm) redirect(`/admin/tm`);

  const { data: importRow } = await supabase
    .from("tm_imports")
    .insert({
      tm_id,
      filename: file!.name,
      status: "processing",
      imported_by: me.id,
    })
    .select("id")
    .single();
  const importId = importRow?.id;

  let parsedTmx;
  try {
    const buf = Buffer.from(await file!.arrayBuffer());
    parsedTmx = parseTmx(buf, { sourceLang: tm!.source_lang, targetLang: tm!.target_lang });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Parse failed";
    if (importId) {
      await supabase.from("tm_imports").update({
        status: "failed",
        error: msg,
        completed_at: new Date().toISOString(),
      }).eq("id", importId);
    }
    redirect(`/admin/tm/${tm_id}?error=${encodeURIComponent(msg)}`);
  }

  // Bulk insert. The DB trigger fills source_hash. We use upsert on the unique key
  // (tm_id, source_hash, target_text) to dedupe re-imports.
  const rows = parsedTmx!.units.map((u) => ({
    tm_id,
    source_text: u.source_text,
    target_text: u.target_text,
    source_hash: "placeholder", // overwritten by trigger
    domain: u.domain ?? null,
    note: u.note ?? null,
    meta: { source_lang_orig: u.source_lang, target_lang_orig: u.target_lang, changedate: u.changedate ?? null },
  }));

  let added = 0;
  let skipped = 0;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error: insErr, count } = await supabase
      .from("tm_units")
      .upsert(slice, { onConflict: "tm_id,source_hash,target_text", ignoreDuplicates: true, count: "exact" });
    if (insErr) {
      if (importId) {
        await supabase.from("tm_imports").update({
          status: "failed",
          error: insErr.message,
          completed_at: new Date().toISOString(),
        }).eq("id", importId);
      }
      redirect(`/admin/tm/${tm_id}?error=${encodeURIComponent(insErr.message)}`);
    }
    added += count ?? slice.length;
  }
  skipped = rows.length - added;

  if (importId) {
    await supabase.from("tm_imports").update({
      status: "completed",
      units_total: rows.length,
      units_added: added,
      units_skipped: skipped,
      completed_at: new Date().toISOString(),
    }).eq("id", importId);
  }

  const h = await headers();
  await audit({
    category: "tm",
    action: "tmx_imported",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "tm",
    targetId: tm_id,
    ip: h.get("x-forwarded-for")?.split(",")[0].trim() || null,
    userAgent: h.get("user-agent") ?? null,
    meta: {
      filename: file!.name,
      total: rows.length,
      added,
      skipped,
      warnings: parsedTmx!.warnings,
    },
  });

  revalidatePath(`/admin/tm/${tm_id}`);
  redirect(`/admin/tm/${tm_id}?imported=${added}&skipped=${skipped}`);
}

const AttachSchema = z.object({
  job_id: z.string().uuid(),
  tm_id: z.string().uuid(),
  priority: z.coerce.number().int().min(1).max(1000).default(100),
});

export async function attachTmToJobAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "pm"]);
  const parsed = AttachSchema.safeParse({
    job_id: formData.get("job_id"),
    tm_id: formData.get("tm_id"),
    priority: formData.get("priority") ?? 100,
  });
  if (!parsed.success) redirect(`/pm/jobs`);
  const { job_id, tm_id, priority } = parsed.data!;

  const supabase = await getServiceClient();
  await supabase.from("job_resources").upsert({
    job_id, resource_type: "tm", resource_id: tm_id, priority,
  }, { onConflict: "job_id,resource_type,resource_id" });

  const h = await headers();
  await audit({
    category: "job",
    action: "tm_attached",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "job",
    targetId: job_id,
    ip: h.get("x-forwarded-for")?.split(",")[0].trim() || null,
    userAgent: h.get("user-agent") ?? null,
    meta: { tm_id, priority },
  });

  revalidatePath(`/pm/jobs/${job_id}`);
  redirect(`/pm/jobs/${job_id}`);
}

export async function detachTmFromJobAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "pm"]);
  const job_id = String(formData.get("job_id") ?? "");
  const tm_id = String(formData.get("tm_id") ?? "");
  if (!job_id || !tm_id) redirect(`/pm/jobs`);

  const supabase = await getServiceClient();
  await supabase.from("job_resources").delete()
    .eq("job_id", job_id)
    .eq("resource_type", "tm")
    .eq("resource_id", tm_id);

  await audit({
    category: "job",
    action: "tm_detached",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "job",
    targetId: job_id,
    meta: { tm_id },
  });

  revalidatePath(`/pm/jobs/${job_id}`);
  redirect(`/pm/jobs/${job_id}`);
}
