"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import { audit } from "@/lib/auth/audit";

const Schema = z.object({
  job_id: z.string().uuid(),
  assigned_to: z.string().uuid().optional().or(z.literal("")),
});

export async function assignJobAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "pm"]);
  const parsed = Schema.safeParse({
    job_id: formData.get("job_id"),
    assigned_to: formData.get("assigned_to") || "",
  });
  if (!parsed.success) {
    redirect(`/pm/jobs?error=${encodeURIComponent("Invalid input")}`);
  }
  const { job_id, assigned_to } = parsed.data!;
  const newAssignee = assigned_to || null;

  const supabase = await getServiceClient();
  const { data: prev } = await supabase.from("jobs").select("assigned_to, status").eq("id", job_id).maybeSingle();
  if (!prev) redirect(`/pm/jobs?error=${encodeURIComponent("Job not found")}`);

  const newStatus = newAssignee
    ? prev!.status === "draft" ? "assigned" : prev!.status
    : "draft";

  const { error } = await supabase
    .from("jobs")
    .update({ assigned_to: newAssignee, status: newStatus })
    .eq("id", job_id);
  if (error) {
    redirect(`/pm/jobs/${job_id}?error=${encodeURIComponent(error.message)}`);
  }

  const h = await headers();
  await audit({
    category: "job",
    action: newAssignee ? "job_assigned" : "job_unassigned",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "job",
    targetId: job_id,
    ip: h.get("x-forwarded-for")?.split(",")[0].trim() || null,
    userAgent: h.get("user-agent") ?? null,
    meta: { from: prev!.assigned_to, to: newAssignee },
  });

  redirect(`/pm/jobs/${job_id}`);
}
