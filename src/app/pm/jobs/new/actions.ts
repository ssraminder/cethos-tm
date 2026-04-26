"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import { detectFormat, extractText, type SupportedFormat } from "@/lib/jobs/extraction";
import { segmentText, totalWords, type Segment } from "@/lib/jobs/segmentation";
import { parseXliff } from "@/lib/xliff/parse";
import { createHash } from "node:crypto";
import { generateJobReference } from "@/lib/jobs/reference";
import { audit } from "@/lib/auth/audit";

const Schema = z.object({
  source_lang: z.string().min(2).max(10),
  target_lang: z.string().min(2).max(10),
  reference: z.string().max(64).optional(),
  assigned_to: z.string().uuid().optional().or(z.literal("")),
  deadline: z.string().optional(),
  project_id: z.string().uuid().optional().or(z.literal("")),
});

const STORAGE_BUCKET = "cat-source-files";

export async function createJobFromUploadAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "pm"]);

  const parsed = Schema.safeParse({
    source_lang: formData.get("source_lang"),
    target_lang: formData.get("target_lang"),
    reference: formData.get("reference") || undefined,
    assigned_to: formData.get("assigned_to") || undefined,
    deadline: formData.get("deadline") || undefined,
    project_id: formData.get("project_id") || undefined,
  });
  if (!parsed.success) {
    redirect(`/pm/jobs/new?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  }
  const { source_lang, target_lang, reference: refOverride, assigned_to, deadline, project_id } = parsed.data!;
  if (source_lang === target_lang) {
    redirect(`/pm/jobs/new?error=${encodeURIComponent("Source and target languages must differ.")}`);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/pm/jobs/new?error=${encodeURIComponent("Please attach a source file.")}`);
  }
  if (file!.size > 50 * 1024 * 1024) {
    redirect(`/pm/jobs/new?error=${encodeURIComponent("File too large. Max 50 MB.")}`);
  }

  const format = detectFormat(file!.name, file!.type) as SupportedFormat;
  if (format === "unknown") {
    redirect(`/pm/jobs/new?error=${encodeURIComponent(`Unsupported file format: ${file!.name}`)}`);
  }

  const buffer = Buffer.from(await file!.arrayBuffer());

  // XLIFF is bilingual — segments come from <trans-unit>, no SBD needed.
  // Pre-existing target text is preserved on the segment with status='draft'
  // (or 'translated' if the XLIFF marked it final/translated/approved).
  let segments: Segment[];
  let preTargets: Map<number, { text: string; status: "draft" | "translated" }> | null = null;
  let actualSourceLang = source_lang;
  let actualTargetLang = target_lang;
  if (format === "xliff") {
    let parsed;
    try {
      parsed = parseXliff(buffer);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "XLIFF parse failed";
      redirect(`/pm/jobs/new?error=${encodeURIComponent(msg)}`);
    }
    if (parsed!.source_lang) actualSourceLang = parsed!.source_lang;
    if (parsed!.target_lang) actualTargetLang = parsed!.target_lang;
    if (actualSourceLang === actualTargetLang) {
      redirect(`/pm/jobs/new?error=${encodeURIComponent("XLIFF source and target languages are identical.")}`);
    }
    if (parsed!.units.length === 0) {
      redirect(`/pm/jobs/new?error=${encodeURIComponent("XLIFF contained no translatable units.")}`);
    }
    segments = [];
    preTargets = new Map();
    parsed!.units.forEach((u, i) => {
      const seq = i + 1;
      const norm = u.source_text.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
      segments.push({
        seq,
        source_text: u.source_text.trim(),
        source_hash: createHash("sha256").update(norm).digest("hex"),
        word_count: u.source_text.trim().split(/\s+/).filter(Boolean).length,
      });
      if (u.target_text && u.target_text.trim()) {
        const isFinal = u.approved === true || u.state === "translated" || u.state === "final";
        preTargets!.set(seq, { text: u.target_text.trim(), status: isFinal ? "translated" : "draft" });
      }
    });
  } else {
    let plain: string;
    try {
      plain = await extractText(buffer, format);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not read file";
      redirect(`/pm/jobs/new?error=${encodeURIComponent(`Extraction failed: ${msg}`)}`);
    }
    segments = segmentText(plain!);
    if (segments.length === 0) {
      redirect(`/pm/jobs/new?error=${encodeURIComponent("No translatable text found in the file.")}`);
    }
  }
  const wordTotal = totalWords(segments);

  // Server-side Supabase (acts as user) — but storage uploads + cross-table inserts
  // need service role to bypass per-job RLS bootstrap. Use service role for the write.
  const service = await getServiceClient();
  const supabase = await getServerClient();

  // If a project was specified, validate it: PM must be able to manage it,
  // and if the project has a vendor pool, the assigned translator must be in it.
  let resolvedProjectId: string | null = null;
  if (project_id) {
    if (me.role !== "admin") {
      const { data: canManage } = await service.rpc("can_manage_project", { p_project_id: project_id });
      if (!canManage) {
        redirect(`/pm/jobs/new?error=${encodeURIComponent("You don't have access to that project.")}`);
      }
    }
    if (assigned_to) {
      const { count: poolSize } = await service
        .from("project_vendors")
        .select("*", { count: "exact", head: true })
        .eq("project_id", project_id);
      if ((poolSize ?? 0) > 0) {
        const { data: inPool } = await service
          .from("project_vendors")
          .select("vendor_id")
          .eq("project_id", project_id)
          .eq("vendor_id", assigned_to)
          .maybeSingle();
        if (!inPool) {
          redirect(`/pm/jobs/new?project=${project_id}&error=${encodeURIComponent("Selected translator isn't in the project's vendor pool.")}`);
        }
      }
    }
    resolvedProjectId = project_id;
  }

  // 1) Create job row first to get a job_id for the storage path.
  const reference = (refOverride && refOverride.trim()) || generateJobReference();
  const jobInsert = {
    reference,
    source: "manual",
    source_lang: actualSourceLang,
    target_lang: actualTargetLang,
    status: assigned_to ? "assigned" : "draft",
    source_filename: file!.name,
    source_format: format,
    word_count: wordTotal,
    segment_count: segments.length,
    created_by: me.id,
    assigned_to: assigned_to || null,
    deadline: deadline || null,
    project_id: resolvedProjectId,
  };
  const { data: job, error: jobErr } = await service
    .from("jobs")
    .insert(jobInsert)
    .select("id, reference")
    .single();
  if (jobErr || !job) {
    redirect(`/pm/jobs/new?error=${encodeURIComponent(jobErr?.message ?? "Failed to create job")}`);
  }

  const jobId = job!.id;
  const storagePath = `jobs/${jobId}/source/${file!.name}`;

  // 2) Upload original file.
  const { error: uploadErr } = await service.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file!.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadErr) {
    await service.from("jobs").delete().eq("id", jobId);
    redirect(`/pm/jobs/new?error=${encodeURIComponent(`Upload failed: ${uploadErr.message}`)}`);
  }
  await service.from("jobs").update({ source_storage_path: storagePath }).eq("id", jobId);

  // 3) Bulk insert segments. For XLIFF, also populate pre-existing target text.
  const rows = segments.map((s) => {
    const pre = preTargets?.get(s.seq);
    return {
      job_id: jobId,
      seq: s.seq,
      source_text: s.source_text,
      source_hash: s.source_hash,
      word_count: s.word_count,
      target_text: pre?.text ?? "",
      status: pre?.status ?? "untranslated",
    };
  });
  // Chunk inserts — Postgres has a parameter limit per statement.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error: segErr } = await service.from("segments").insert(slice);
    if (segErr) {
      await service.from("segments").delete().eq("job_id", jobId);
      await service.storage.from(STORAGE_BUCKET).remove([storagePath]);
      await service.from("jobs").delete().eq("id", jobId);
      redirect(`/pm/jobs/new?error=${encodeURIComponent(`Segmentation insert failed: ${segErr.message}`)}`);
    }
  }

  const h = await headers();
  await audit({
    category: "job",
    action: "job_created_manual",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "job",
    targetId: jobId,
    ip: h.get("x-forwarded-for")?.split(",")[0].trim() || null,
    userAgent: h.get("user-agent") ?? null,
    meta: {
      reference,
      source_lang,
      target_lang,
      filename: file!.name,
      format,
      segments: segments.length,
      words: wordTotal,
      assigned_to: assigned_to || null,
    },
  });

  // Touch supabase server client to prevent unused-warning during build.
  void supabase;

  redirect(`/pm/jobs/${jobId}?created=1`);
}
