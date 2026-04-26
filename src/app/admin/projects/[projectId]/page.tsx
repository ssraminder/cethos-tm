import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, KpiCard } from "@/components/AppShell";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import { updateProjectAction, assignPmAction, removePmAction, assignVendorAction, removeVendorAction } from "../actions";

export default async function ProjectDetail({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const me = await requireRole(["admin", "pm"]);
  const { projectId } = await params;
  const sp = await searchParams;

  const supabase = await getServiceClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*, clients(id, name)")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: clients }, { data: assignedPms }, { data: assignedVendors }, { data: jobs }, { data: allPms }, { data: allVendors }] = await Promise.all([
    supabase.from("clients").select("id, name").eq("active", true).order("name"),
    supabase.from("project_pms").select("pm_id, profiles!inner(id, email, full_name)").eq("project_id", projectId),
    supabase.from("project_vendors").select("vendor_id, profiles!inner(id, email, full_name, role)").eq("project_id", projectId),
    supabase.from("jobs").select("id, reference, status, assigned_to, source_lang, target_lang, deadline, created_at").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, email, full_name").eq("role", "pm").eq("status", "active").order("full_name"),
    supabase.from("profiles").select("id, email, full_name, role").in("role", ["translator", "reviewer"]).eq("status", "active").order("full_name"),
  ]);

  const pmIds = new Set((assignedPms ?? []).map((p) => p.pm_id));
  const vendorIds = new Set((assignedVendors ?? []).map((v) => v.vendor_id));
  const isAdmin = me.role === "admin";

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={`${(project as { clients?: { name: string } | null }).clients?.name ? `${(project as { clients?: { name: string } | null }).clients?.name} · ` : ""}${project.status.replace("_", " ")}${project.reference ? ` · ${project.reference}` : ""}`}
      />

      {sp.error && (
        <div className="mb-4 rounded-md border border-[color:var(--color-rose-100)] bg-[color:var(--color-rose-50)] text-[color:var(--color-rose-600)] px-3 py-2 text-sm">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Status" value={project.status.replace("_", " ")} />
        <KpiCard label="Jobs" value={String((jobs ?? []).length)} />
        <KpiCard label="PMs" value={pmIds.size === 0 ? "All" : String(pmIds.size)} hint={pmIds.size === 0 ? "No explicit assignment — every PM sees this" : undefined} />
        <KpiCard label="Vendor pool" value={vendorIds.size === 0 ? "Any" : String(vendorIds.size)} hint={vendorIds.size === 0 ? "Any translator can be assigned" : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Edit metadata */}
        <div className="bg-white rounded-xl border border-[color:var(--color-border)] p-5">
          <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-3">Project</div>
          <form action={updateProjectAction} className="space-y-3">
            <input type="hidden" name="id" value={project.id} />
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Name</label>
              <input type="text" name="name" required defaultValue={project.name} maxLength={160}
                className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Reference</label>
                <input type="text" name="reference" defaultValue={project.reference ?? ""} maxLength={64}
                  className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2 text-sm mono" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Status</label>
                <select name="status" defaultValue={project.status} className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2 text-sm">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="on_hold">On hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Client</label>
                <select name="client_id" defaultValue={project.client_id ?? ""} className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2 text-sm">
                  <option value="">— None —</option>
                  {clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Deadline</label>
                <input type="datetime-local" name="deadline"
                  defaultValue={project.deadline ? new Date(project.deadline).toISOString().slice(0, 16) : ""}
                  className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Description</label>
              <textarea name="description" defaultValue={project.description ?? ""} rows={3} maxLength={2000}
                className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2 text-sm" />
            </div>
            <button type="submit" className="px-3 py-2 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] text-white">Save</button>
          </form>
        </div>

        {/* PM assignment (admin only) */}
        <div className="bg-white rounded-xl border border-[color:var(--color-border)] p-5">
          <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-3">Project managers</div>
          {!isAdmin ? (
            <p className="text-sm text-[color:var(--color-slate-500)]">PM assignment is admin-only.</p>
          ) : (
            <>
              {pmIds.size === 0 ? (
                <p className="text-sm text-[color:var(--color-slate-500)] mb-3">No explicit assignments — visible to <span className="font-semibold text-[color:var(--color-navy)]">all PMs</span>.</p>
              ) : (
                <ul className="space-y-1.5 mb-4">
                  {(assignedPms ?? []).map((p) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const prof = (p as any).profiles;
                    return (
                      <li key={p.pm_id} className="flex items-center justify-between rounded-md border border-[color:var(--color-border)] p-2">
                        <div className="text-sm">
                          <span className="font-semibold text-[color:var(--color-navy)]">{prof.full_name || prof.email}</span>
                          <span className="ml-2 text-[10px] text-[color:var(--color-slate-500)]">{prof.email}</span>
                        </div>
                        <form action={removePmAction}>
                          <input type="hidden" name="project_id" value={project.id} />
                          <input type="hidden" name="pm_id" value={p.pm_id} />
                          <button type="submit" className="text-xs font-semibold text-[color:var(--color-rose-600)] hover:underline">Remove</button>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              )}
              {(allPms ?? []).filter((p) => !pmIds.has(p.id)).length > 0 ? (
                <form action={assignPmAction} className="flex items-end gap-2">
                  <input type="hidden" name="project_id" value={project.id} />
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-1">Add PM</label>
                    <select name="pm_id" required className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2 text-sm">
                      {(allPms ?? []).filter((p) => !pmIds.has(p.id)).map((p) => (
                        <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="px-3 py-2 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] text-white">Assign</button>
                </form>
              ) : (
                <p className="text-xs text-[color:var(--color-slate-500)]">All active PMs are already assigned.</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Vendor pool */}
      <div className="bg-white rounded-xl border border-[color:var(--color-border)] p-5 mb-6">
        <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-3">Vendor pool</div>
        {vendorIds.size === 0 ? (
          <p className="text-sm text-[color:var(--color-slate-500)] mb-3">No pool defined — <span className="font-semibold text-[color:var(--color-navy)]">any translator</span> can be assigned to jobs in this project.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
            {(assignedVendors ?? []).map((v) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const prof = (v as any).profiles;
              return (
                <li key={v.vendor_id} className="flex items-center justify-between rounded-md border border-[color:var(--color-border)] p-2">
                  <div className="text-sm min-w-0">
                    <div className="font-semibold text-[color:var(--color-navy)] truncate">{prof.full_name || prof.email}</div>
                    <div className="text-[10px] text-[color:var(--color-slate-500)] capitalize">{prof.role}</div>
                  </div>
                  <form action={removeVendorAction}>
                    <input type="hidden" name="project_id" value={project.id} />
                    <input type="hidden" name="vendor_id" value={v.vendor_id} />
                    <button type="submit" className="text-xs font-semibold text-[color:var(--color-rose-600)] hover:underline">Remove</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        {(allVendors ?? []).filter((v) => !vendorIds.has(v.id)).length > 0 ? (
          <form action={assignVendorAction} className="flex items-end gap-2">
            <input type="hidden" name="project_id" value={project.id} />
            <div className="flex-1">
              <label className="block text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-1">Add vendor to pool</label>
              <select name="vendor_id" required className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2 text-sm">
                {(allVendors ?? []).filter((v) => !vendorIds.has(v.id)).map((v) => (
                  <option key={v.id} value={v.id}>{v.full_name || v.email} ({v.role})</option>
                ))}
              </select>
            </div>
            <button type="submit" className="px-3 py-2 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] text-white">Add</button>
          </form>
        ) : (
          <p className="text-xs text-[color:var(--color-slate-500)]">All translators/reviewers are already in the pool.</p>
        )}
      </div>

      {/* Jobs */}
      <div className="bg-white rounded-xl border border-[color:var(--color-border)] overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between border-b border-[color:var(--color-border-soft)]">
          <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)]">Jobs in this project</div>
          <Link href={`/pm/jobs/new?project=${project.id}`} className="text-xs font-semibold text-[color:var(--color-teal-700)] hover:underline">+ Add a job</Link>
        </div>
        {(jobs ?? []).length === 0 ? (
          <div className="p-6 text-sm text-[color:var(--color-slate-500)] text-center">No jobs yet. Create one from the PM panel.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--color-slate-50)] text-[color:var(--color-slate-500)] text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2 font-bold">Reference</th>
                <th className="text-left px-4 py-2 font-bold">Pair</th>
                <th className="text-left px-4 py-2 font-bold">Status</th>
                <th className="text-left px-4 py-2 font-bold">Deadline</th>
                <th className="text-left px-4 py-2 font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {jobs!.map((j) => (
                <tr key={j.id} className="border-t border-[color:var(--color-border-soft)]">
                  <td className="px-4 py-2 mono">{j.reference}</td>
                  <td className="px-4 py-2">{j.source_lang} → {j.target_lang}</td>
                  <td className="px-4 py-2 capitalize">{j.status.replace("_", " ")}</td>
                  <td className="px-4 py-2 text-xs text-[color:var(--color-slate-500)]">{j.deadline ? new Date(j.deadline).toLocaleString() : "—"}</td>
                  <td className="px-4 py-2"><Link href={`/pm/jobs/${j.id}`} className="text-[color:var(--color-teal-700)] font-semibold">Open →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
