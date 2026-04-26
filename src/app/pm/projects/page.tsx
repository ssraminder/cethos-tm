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

export default async function PmProjectsPage() {
  const me = await requireRole(["admin", "pm"]);
  const supabase = await getServiceClient();

  // Find projects this PM can manage:
  //   admin → all
  //   PM    → explicitly assigned OR projects with no PM assignments at all
  type ProjectRow = { id: string; name: string; reference: string | null; status: string; deadline: string | null; clients: { name: string } | null; assignment: "explicit" | "default" };
  let projects: ProjectRow[] = [];

  if (me.role === "admin") {
    const { data } = await supabase
      .from("projects")
      .select("id, name, reference, status, deadline, clients(name)")
      .order("created_at", { ascending: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    projects = (data ?? []).map((p: any) => ({
      id: p.id, name: p.name, reference: p.reference, status: p.status, deadline: p.deadline,
      clients: Array.isArray(p.clients) ? (p.clients[0] ?? null) : (p.clients ?? null),
      assignment: "explicit" as const,
    }));
  } else {
    const [{ data: explicit }, { data: defaultAll }] = await Promise.all([
      // PMs explicitly assigned
      supabase
        .from("project_pms")
        .select("projects!inner(id, name, reference, status, deadline, clients(name))")
        .eq("pm_id", me.id),
      // Projects with no PM assignments — visible to all PMs
      supabase
        .from("projects")
        .select("id, name, reference, status, deadline, clients(name), project_pms(pm_id)")
        .order("created_at", { ascending: false }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const explicitItems: ProjectRow[] = (explicit ?? []).map((r: any) => {
      const p = r.projects;
      return {
        id: p.id, name: p.name, reference: p.reference, status: p.status, deadline: p.deadline,
        clients: Array.isArray(p.clients) ? (p.clients[0] ?? null) : (p.clients ?? null),
        assignment: "explicit" as const,
      };
    });
    const explicitIds = new Set(explicitItems.map((p) => p.id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const defaultItems: ProjectRow[] = (defaultAll ?? []).filter((p: any) => (p.project_pms?.length ?? 0) === 0 && !explicitIds.has(p.id))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => ({
        id: p.id, name: p.name, reference: p.reference, status: p.status, deadline: p.deadline,
        clients: Array.isArray(p.clients) ? (p.clients[0] ?? null) : (p.clients ?? null),
        assignment: "default" as const,
      }));
    projects = [...explicitItems, ...defaultItems];
  }

  const ids = projects.map((p) => p.id);
  const jobsCount: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: jobs } = await supabase.from("jobs").select("project_id").in("project_id", ids);
    for (const id of ids) jobsCount[id] = 0;
    for (const r of jobs ?? []) if (r.project_id) jobsCount[r.project_id] = (jobsCount[r.project_id] ?? 0) + 1;
  }

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle={me.role === "admin"
          ? "Every project in the workspace."
          : "Projects you manage explicitly, plus open ones available to all PMs."}
      />

      {projects.length === 0 ? (
        <PlaceholderCard title="No projects available" body={me.role === "admin" ? "Create one to get started." : "An admin hasn't assigned you to any projects, and there are no open projects available to all PMs."} />
      ) : (
        <div className="bg-white rounded-xl border border-[color:var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--color-slate-50)] text-[color:var(--color-slate-500)] text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2 font-bold">Project</th>
                <th className="text-left px-4 py-2 font-bold">Client</th>
                <th className="text-left px-4 py-2 font-bold">Status</th>
                <th className="text-left px-4 py-2 font-bold">Assignment</th>
                <th className="text-left px-4 py-2 font-bold">Jobs</th>
                <th className="text-left px-4 py-2 font-bold">Deadline</th>
                <th className="text-left px-4 py-2 font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-t border-[color:var(--color-border-soft)] hover:bg-[color:var(--color-slate-50)]">
                  <td className="px-4 py-2">
                    <div className="font-semibold text-[color:var(--color-navy)]">{p.name}</div>
                    {p.reference && <div className="text-xs text-[color:var(--color-slate-500)] mono">{p.reference}</div>}
                  </td>
                  <td className="px-4 py-2 text-[color:var(--color-slate-600)]">{p.clients?.name ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className={["inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide", STATUS_TINT[p.status] ?? ""].join(" ")}>
                      {p.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {p.assignment === "explicit"
                      ? <span className="text-[color:var(--color-teal-700)] font-semibold">You</span>
                      : <span className="text-[color:var(--color-slate-500)]">Open to all PMs</span>}
                  </td>
                  <td className="px-4 py-2 mono">{jobsCount[p.id] ?? 0}</td>
                  <td className="px-4 py-2 text-xs text-[color:var(--color-slate-500)]">{p.deadline ? new Date(p.deadline).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-2"><Link href={`/pm/projects/${p.id}`} className="text-[color:var(--color-teal-700)] font-semibold">Open →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
