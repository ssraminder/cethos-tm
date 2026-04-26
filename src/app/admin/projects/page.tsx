import Link from "next/link";
import { PageHeader, PlaceholderCard } from "@/components/AppShell";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";

const STATUS_TINT: Record<string, string> = {
  draft: "bg-[color:var(--color-slate-100)] text-[color:var(--color-slate-600)]",
  active: "bg-[color:var(--color-emerald-100)] text-[color:var(--color-emerald-700)]",
  on_hold: "bg-[color:var(--color-amber-100)] text-[color:var(--color-amber-600)]",
  completed: "bg-[color:var(--color-slate-200)] text-[color:var(--color-slate-700)]",
  cancelled: "bg-[color:var(--color-rose-100)] text-[color:var(--color-rose-600)]",
};

export default async function AdminProjectsPage() {
  await requireRole(["admin"]);
  const supabase = await getServiceClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, reference, status, deadline, created_at, clients(name)")
    .order("created_at", { ascending: false });

  const ids = (projects ?? []).map((p) => p.id);
  const counts: Record<string, { jobs: number; pms: number; vendors: number }> = {};
  if (ids.length > 0) {
    const [jobsRes, pmsRes, vendorsRes] = await Promise.all([
      supabase.from("jobs").select("project_id").in("project_id", ids),
      supabase.from("project_pms").select("project_id").in("project_id", ids),
      supabase.from("project_vendors").select("project_id").in("project_id", ids),
    ]);
    for (const id of ids) counts[id] = { jobs: 0, pms: 0, vendors: 0 };
    for (const r of jobsRes.data ?? []) counts[r.project_id!].jobs++;
    for (const r of pmsRes.data ?? []) counts[r.project_id].pms++;
    for (const r of vendorsRes.data ?? []) counts[r.project_id].vendors++;
  }

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Group jobs by initiative. Assign PMs to scope visibility, pre-approve vendors to scope assignment."
        actions={<Link href="/admin/projects/new" className="px-3 py-2 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] text-white">Create project</Link>}
      />

      {!projects || projects.length === 0 ? (
        <PlaceholderCard title="No projects yet" body="Create one to organize related jobs and assign PMs/vendors." />
      ) : (
        <div className="bg-white rounded-xl border border-[color:var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--color-slate-50)] text-[color:var(--color-slate-500)] text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2 font-bold">Project</th>
                <th className="text-left px-4 py-2 font-bold">Client</th>
                <th className="text-left px-4 py-2 font-bold">Status</th>
                <th className="text-left px-4 py-2 font-bold">PMs</th>
                <th className="text-left px-4 py-2 font-bold">Vendors</th>
                <th className="text-left px-4 py-2 font-bold">Jobs</th>
                <th className="text-left px-4 py-2 font-bold">Deadline</th>
                <th className="text-left px-4 py-2 font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const client = (p as any).clients;
                const c = counts[p.id] ?? { jobs: 0, pms: 0, vendors: 0 };
                return (
                  <tr key={p.id} className="border-t border-[color:var(--color-border-soft)] hover:bg-[color:var(--color-slate-50)]">
                    <td className="px-4 py-2">
                      <div className="font-semibold text-[color:var(--color-navy)]">{p.name}</div>
                      {p.reference && <div className="text-xs text-[color:var(--color-slate-500)] mono">{p.reference}</div>}
                    </td>
                    <td className="px-4 py-2 text-[color:var(--color-slate-600)]">{client?.name ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className={["inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide", STATUS_TINT[p.status] ?? ""].join(" ")}>
                        {p.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2 mono">{c.pms === 0 ? <span className="text-[color:var(--color-slate-400)]" title="Available to all PMs">all</span> : c.pms}</td>
                    <td className="px-4 py-2 mono">{c.vendors === 0 ? <span className="text-[color:var(--color-slate-400)]" title="No vendor pool — any translator">any</span> : c.vendors}</td>
                    <td className="px-4 py-2 mono">{c.jobs}</td>
                    <td className="px-4 py-2 text-xs text-[color:var(--color-slate-500)]">{p.deadline ? new Date(p.deadline).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-2"><Link href={`/admin/projects/${p.id}`} className="text-[color:var(--color-teal-700)] font-semibold">Open →</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
