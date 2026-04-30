import Link from "next/link";
import { PageHeader } from "@/components/AppShell";
import { getServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["draft", "assigned", "in_progress", "review", "qa_running", "qa_review"];

export default async function TranslatorsPage() {
  const supabase = await getServiceClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .in("role", ["translator", "reviewer"])
    .order("full_name", { ascending: true });

  const ids = (profiles ?? []).map((p) => (p as { id: string }).id);

  const { data: openJobs } = ids.length > 0
    ? await supabase
        .from("jobs")
        .select("assigned_to, word_count, status")
        .in("assigned_to", ids)
        .in("status", ACTIVE_STATUSES)
    : { data: [] };

  const stats = new Map<string, { open: number; words: number; qa: number }>();
  for (const j of (openJobs ?? []) as Array<{ assigned_to: string | null; word_count: number; status: string }>) {
    if (!j.assigned_to) continue;
    const cur = stats.get(j.assigned_to) ?? { open: 0, words: 0, qa: 0 };
    cur.open += 1;
    cur.words += j.word_count ?? 0;
    if (j.status === "qa_review") cur.qa += 1;
    stats.set(j.assigned_to, cur);
  }

  return (
    <>
      <PageHeader
        title="Translators"
        subtitle="Workload across the team — sourced from job assignments."
      />
      {(profiles ?? []).length === 0 ? (
        <div className="rounded-lg border border-dashed border-[color:var(--color-border)] p-6 text-sm text-[color:var(--color-slate-500)] italic">
          No translator or reviewer accounts yet. Translators are added either via the
          vendor portal recruitment flow, or by an admin in <Link href="/admin/users" className="text-[color:var(--color-teal-700)] underline">Users</Link>.
        </div>
      ) : (
        <div className="rounded-lg bg-white border border-[color:var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--color-slate-50)] text-[10px] uppercase tracking-wider text-[color:var(--color-slate-500)]">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Email</th>
                <th className="text-left px-4 py-2">Role</th>
                <th className="text-right px-4 py-2">Open jobs</th>
                <th className="text-right px-4 py-2">Words pending</th>
                <th className="text-right px-4 py-2">In QA review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border-soft)]">
              {(profiles ?? []).map((p) => {
                const profile = p as { id: string; full_name: string | null; email: string; role: string };
                const s = stats.get(profile.id) ?? { open: 0, words: 0, qa: 0 };
                return (
                  <tr key={profile.id} className="hover:bg-[color:var(--color-slate-50)]">
                    <td className="px-4 py-2.5 font-semibold text-[color:var(--color-navy)]">
                      {profile.full_name || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[color:var(--color-slate-600)]">
                      {profile.email}
                    </td>
                    <td className="px-4 py-2.5 text-[color:var(--color-slate-500)] capitalize text-xs">
                      {profile.role}
                    </td>
                    <td className="px-4 py-2.5 text-right mono">{s.open}</td>
                    <td className="px-4 py-2.5 text-right mono text-[color:var(--color-slate-500)]">
                      {s.words.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {s.qa > 0 ? (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-[color:var(--color-rose-50)] text-[color:var(--color-rose-700)] text-xs font-semibold">
                          {s.qa}
                        </span>
                      ) : (
                        <span className="text-[color:var(--color-slate-400)] text-xs">—</span>
                      )}
                    </td>
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
