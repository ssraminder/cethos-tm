"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import { audit } from "@/lib/auth/audit";

const CreateSchema = z.object({
  name: z.string().min(1).max(160),
  reference: z.string().max(64).optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
  client_id: z.string().uuid().optional().or(z.literal("")),
  deadline: z.string().optional().or(z.literal("")),
  status: z.enum(["draft", "active", "on_hold", "completed", "cancelled"]).default("draft"),
});

export async function createProjectAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin"]);
  const parsed = CreateSchema.safeParse({
    name: formData.get("name"),
    reference: formData.get("reference") || "",
    description: formData.get("description") || "",
    client_id: formData.get("client_id") || "",
    deadline: formData.get("deadline") || "",
    status: formData.get("status") || "draft",
  });
  if (!parsed.success) {
    redirect(`/admin/projects/new?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  }
  const v = parsed.data!;

  const supabase = await getServiceClient();
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      name: v.name,
      reference: v.reference || null,
      description: v.description || null,
      client_id: v.client_id || null,
      deadline: v.deadline || null,
      status: v.status,
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error || !project) {
    redirect(`/admin/projects/new?error=${encodeURIComponent(error?.message ?? "Failed to create project")}`);
  }

  const h = await headers();
  await audit({
    category: "settings",
    action: "project_created",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "project",
    targetId: project!.id,
    ip: h.get("x-forwarded-for")?.split(",")[0].trim() || null,
    userAgent: h.get("user-agent"),
    meta: { name: v.name, client_id: v.client_id || null },
  });

  redirect(`/admin/projects/${project!.id}`);
}

const UpdateSchema = CreateSchema.extend({ id: z.string().uuid() });

export async function updateProjectAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "pm"]);
  const parsed = UpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    reference: formData.get("reference") || "",
    description: formData.get("description") || "",
    client_id: formData.get("client_id") || "",
    deadline: formData.get("deadline") || "",
    status: formData.get("status") || "draft",
  });
  if (!parsed.success) {
    redirect(`/admin/projects?error=${encodeURIComponent("Invalid input")}`);
  }
  const v = parsed.data!;
  const supabase = await getServiceClient();

  // PM permission check: must be able to manage the project.
  if (me.role !== "admin") {
    const { data: rpc } = await supabase.rpc("can_manage_project", { p_project_id: v.id });
    if (!rpc) redirect(`/admin/projects?error=${encodeURIComponent("Forbidden")}`);
  }

  const { error } = await supabase.from("projects").update({
    name: v.name,
    reference: v.reference || null,
    description: v.description || null,
    client_id: v.client_id || null,
    deadline: v.deadline || null,
    status: v.status,
  }).eq("id", v.id);
  if (error) redirect(`/admin/projects/${v.id}?error=${encodeURIComponent(error.message)}`);

  await audit({
    category: "settings",
    action: "project_updated",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "project",
    targetId: v.id,
    meta: { name: v.name, status: v.status },
  });

  revalidatePath(`/admin/projects/${v.id}`);
  revalidatePath("/admin/projects");
  revalidatePath(`/pm/projects/${v.id}`);
  redirect(`/admin/projects/${v.id}`);
}

const PmAssignSchema = z.object({
  project_id: z.string().uuid(),
  pm_id: z.string().uuid(),
});

export async function assignPmAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin"]);
  const parsed = PmAssignSchema.safeParse({
    project_id: formData.get("project_id"),
    pm_id: formData.get("pm_id"),
  });
  if (!parsed.success) redirect("/admin/projects");

  const supabase = await getServiceClient();
  const { error } = await supabase.from("project_pms").upsert(
    { project_id: parsed.data!.project_id, pm_id: parsed.data!.pm_id },
    { onConflict: "project_id,pm_id" }
  );
  if (error) redirect(`/admin/projects/${parsed.data!.project_id}?error=${encodeURIComponent(error.message)}`);

  await audit({
    category: "user",
    action: "project_pm_assigned",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "project",
    targetId: parsed.data!.project_id,
    meta: { pm_id: parsed.data!.pm_id },
  });
  revalidatePath(`/admin/projects/${parsed.data!.project_id}`);
  redirect(`/admin/projects/${parsed.data!.project_id}`);
}

export async function removePmAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin"]);
  const project_id = String(formData.get("project_id") ?? "");
  const pm_id = String(formData.get("pm_id") ?? "");
  if (!project_id || !pm_id) redirect("/admin/projects");
  const supabase = await getServiceClient();
  await supabase.from("project_pms").delete().eq("project_id", project_id).eq("pm_id", pm_id);
  await audit({
    category: "user",
    action: "project_pm_removed",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "project",
    targetId: project_id,
    meta: { pm_id },
  });
  revalidatePath(`/admin/projects/${project_id}`);
  redirect(`/admin/projects/${project_id}`);
}

const VendorAssignSchema = z.object({
  project_id: z.string().uuid(),
  vendor_id: z.string().uuid(),
});

export async function assignVendorAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "pm"]);
  const parsed = VendorAssignSchema.safeParse({
    project_id: formData.get("project_id"),
    vendor_id: formData.get("vendor_id"),
  });
  if (!parsed.success) redirect("/admin/projects");

  const supabase = await getServiceClient();
  if (me.role !== "admin") {
    const { data: rpc } = await supabase.rpc("can_manage_project", { p_project_id: parsed.data!.project_id });
    if (!rpc) redirect(`/admin/projects/${parsed.data!.project_id}?error=${encodeURIComponent("Forbidden")}`);
  }
  const { error } = await supabase.from("project_vendors").upsert(
    { project_id: parsed.data!.project_id, vendor_id: parsed.data!.vendor_id },
    { onConflict: "project_id,vendor_id" }
  );
  if (error) redirect(`/admin/projects/${parsed.data!.project_id}?error=${encodeURIComponent(error.message)}`);

  await audit({
    category: "user",
    action: "project_vendor_assigned",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "project",
    targetId: parsed.data!.project_id,
    meta: { vendor_id: parsed.data!.vendor_id },
  });
  revalidatePath(`/admin/projects/${parsed.data!.project_id}`);
  revalidatePath(`/pm/projects/${parsed.data!.project_id}`);
  redirect(`/admin/projects/${parsed.data!.project_id}`);
}

export async function removeVendorAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "pm"]);
  const project_id = String(formData.get("project_id") ?? "");
  const vendor_id = String(formData.get("vendor_id") ?? "");
  if (!project_id || !vendor_id) redirect("/admin/projects");

  const supabase = await getServiceClient();
  if (me.role !== "admin") {
    const { data: rpc } = await supabase.rpc("can_manage_project", { p_project_id: project_id });
    if (!rpc) redirect(`/admin/projects/${project_id}?error=${encodeURIComponent("Forbidden")}`);
  }
  await supabase.from("project_vendors").delete().eq("project_id", project_id).eq("vendor_id", vendor_id);

  await audit({
    category: "user",
    action: "project_vendor_removed",
    actorId: me.id,
    actorEmail: me.email,
    targetType: "project",
    targetId: project_id,
    meta: { vendor_id },
  });
  revalidatePath(`/admin/projects/${project_id}`);
  revalidatePath(`/pm/projects/${project_id}`);
  redirect(`/admin/projects/${project_id}`);
}
