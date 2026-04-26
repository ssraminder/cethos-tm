import { PageHeader, PlaceholderCard } from "@/components/AppShell";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import Link from "next/link";

export default async function JobsPage() {
  await requireRole(["admin", "pm"]);
  const supabase = await getServiceClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, reference, source, source_lang, target_lang, status, word_count, segment_count, deadline, created_at, project_id, projects(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <PageHeader
        title="Jobs"
        subtitle="TMS-pushed and manually created jobs."
        actions={<Link href="/pm/jobs/new" className="px-3 py-2 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] text-white">Create job</Link>}
      />
      {!jobs || jobs.length === 0 ? (
        <PlaceholderCard title="No jobs yet" body="Create one or wait for the TMS to push the first ingest." />
      ) : (
        <div className="bg-white rounded-xl border border-[color:var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--color-slate-50)] text-[color:var(--color-slate-500)] text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2 font-bold">Reference</th>
                <th className="text-left px-4 py-2 font-bold">Project</th>
                <th className="text-left px-4 py-2 font-bold">Source</th>
                <th className="text-left px-4 py-2 font-bold">Pair</th>
                <th className="text-left px-4 py-2 font-bold">Words</th>
                <th className="text-left px-4 py-2 font-bold">Status</th>
                <th className="text-left px-4 py-2 font-bold">Deadline</th>
                <th className="text-left px-4 py-2 font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const proj = (j as any).projects;
                return (
                  <tr key={j.id} className="border-t border-[color:var(--color-border-soft)] hover:bg-[color:var(--color-slate-50)]">
                    <td className="px-4 py-2 mono">{j.reference}</td>
                    <td className="px-4 py-2">
                      {j.project_id ? (
                        <Link href={`/pm/projects/${j.project_id}`} className="text-[color:var(--color-teal-700)] hover:underline">{proj?.name ?? "(project)"}</Link>
                      ) : (
                        <span className="text-[color:var(--color-slate-400)] text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 capitalize">{j.source.replace("_", " ")}</td>
                    <td className="px-4 py-2">{j.source_lang} → {j.target_lang}</td>
                    <td className="px-4 py-2">{j.word_count.toLocaleString()}</td>
                    <td className="px-4 py-2 capitalize">{j.status.replace("_", " ")}</td>
                    <td className="px-4 py-2 text-xs">{j.deadline ? new Date(j.deadline).toLocaleString() : "—"}</td>
                    <td className="px-4 py-2"><Link href={`/pm/jobs/${j.id}`} className="text-[color:var(--color-teal-700)] font-semibold">Open →</Link></td>
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
