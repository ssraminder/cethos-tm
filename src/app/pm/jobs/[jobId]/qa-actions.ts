"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireRole } from "@/lib/auth/current-user";
import { runQaForJob } from "@/lib/qa/run";
import { audit } from "@/lib/auth/audit";

export async function runQaAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "pm", "translator", "reviewer"]);
  const job_id = String(formData.get("job_id") ?? "");
  if (!job_id) redirect("/pm/jobs");

  let result;
  try {
    result = await runQaForJob(job_id);
  } catch (e) {
    redirect(`/pm/jobs/${job_id}?error=${encodeURIComponent(e instanceof Error ? e.message : "QA failed")}`);
  }

  const h = await headers();
  await audit({
    category: "qa",
    action: "qa_run",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "job",
    targetId: job_id,
    ip: h.get("x-forwarded-for")?.split(",")[0].trim() || null,
    userAgent: h.get("user-agent") ?? null,
    meta: { ...result! },
  });

  revalidatePath(`/pm/jobs/${job_id}`);
  revalidatePath(`/translator/editor/${job_id}`);
  redirect(`/pm/jobs/${job_id}?qa_critical=${result!.findings_by_severity.critical ?? 0}&qa_major=${result!.findings_by_severity.major ?? 0}&qa_minor=${result!.findings_by_severity.minor ?? 0}`);
}
