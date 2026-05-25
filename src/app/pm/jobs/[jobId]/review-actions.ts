"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireRole } from "@/lib/auth/current-user";
import { getServiceClient } from "@/lib/supabase/server";
import { audit } from "@/lib/auth/audit";

/** Transition a delivered job into PM review. */
export async function startReviewAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "pm"]);
  const jobId = String(formData.get("job_id") ?? "");
  if (!jobId) redirect("/pm/jobs");

  const supabase = await getServiceClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, status")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) redirect(`/pm/jobs?error=${encodeURIComponent("Job not found")}`);
  if (job.status !== "delivered") {
    redirect(`/pm/jobs/${jobId}?error=${encodeURIComponent(`Cannot start review: job is ${job.status}, expected delivered`)}`);
  }

  await supabase.from("jobs").update({ status: "pm_review", reviewer_id: me.id }).eq("id", jobId);

  const h = await headers();
  await audit({
    category: "job",
    action: "pm_review_started",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "job",
    targetId: jobId,
    ip: h.get("x-forwarded-for")?.split(",")[0].trim() || null,
    userAgent: h.get("user-agent") ?? null,
  });

  revalidatePath(`/pm/jobs/${jobId}`);
  redirect(`/pm/jobs/${jobId}`);
}

/** Approve a reviewed job. */
export async function approveJobAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "pm"]);
  const jobId = String(formData.get("job_id") ?? "");
  if (!jobId) redirect("/pm/jobs");

  const supabase = await getServiceClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, status")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) redirect(`/pm/jobs?error=${encodeURIComponent("Job not found")}`);
  if (job.status !== "pm_review") {
    redirect(`/pm/jobs/${jobId}?error=${encodeURIComponent(`Cannot approve: job is ${job.status}, expected pm_review`)}`);
  }

  await supabase.from("jobs").update({ status: "approved" }).eq("id", jobId);

  const h = await headers();
  await audit({
    category: "job",
    action: "pm_approved",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "job",
    targetId: jobId,
    ip: h.get("x-forwarded-for")?.split(",")[0].trim() || null,
    userAgent: h.get("user-agent") ?? null,
  });

  revalidatePath(`/pm/jobs/${jobId}`);
  redirect(`/pm/jobs/${jobId}`);
}

/** Send a reviewed job back to the translator for revision. */
export async function requestRevisionAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "pm"]);
  const jobId = String(formData.get("job_id") ?? "");
  const note = String(formData.get("revision_note") ?? "").trim();
  if (!jobId) redirect("/pm/jobs");

  const supabase = await getServiceClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, status")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) redirect(`/pm/jobs?error=${encodeURIComponent("Job not found")}`);
  if (job.status !== "pm_review") {
    redirect(`/pm/jobs/${jobId}?error=${encodeURIComponent(`Cannot request revision: job is ${job.status}`)}`);
  }

  // Set status back to revision_requested so the translator can re-open
  await supabase.from("jobs").update({ status: "revision_requested" }).eq("id", jobId);

  // Store the revision note as an audit entry so it's traceable
  const h = await headers();
  await audit({
    category: "job",
    action: "pm_revision_requested",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "job",
    targetId: jobId,
    ip: h.get("x-forwarded-for")?.split(",")[0].trim() || null,
    userAgent: h.get("user-agent") ?? null,
    meta: { note: note || null },
  });

  revalidatePath(`/pm/jobs/${jobId}`);
  redirect(`/pm/jobs/${jobId}`);
}
