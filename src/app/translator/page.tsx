import { PageHeader, KpiCard, PlaceholderCard } from "@/components/AppShell";
import { getServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import Link from "next/link";

export default async function TranslatorInbox() {
  const me = await getCurrentUser();
  const supabase = await getServiceClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, reference, source_lang, target_lang, status, word_count, segment_count, deadline")
    .eq("assigned_to", me.id)
    .in("status", ["assigned", "in_progress", "review"])
    .order("deadline", { ascending: true });

  return (
    <>
      <PageHeader title={`Welcome back, ${me.full_name?.split(" ")[0] ?? me.email}`} subtitle="Your assigned jobs in progress." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="In progress" value={String(jobs?.filter(j => j.status === "in_progress").length ?? 0)} />
        <KpiCard label="Assigned" value={String(jobs?.filter(j => j.status === "assigned").length ?? 0)} />
        <KpiCard label="In review" value={String(jobs?.filter(j => j.status === "review").length ?? 0)} />
        <KpiCard label="Words pending" value={(jobs?.reduce((s, j) => s + (j.word_count ?? 0), 0) ?? 0).toLocaleString()} />
      </div>

      {!jobs || jobs.length === 0 ? (
        <PlaceholderCard
          title="No jobs assigned"
          body="When the vendor portal hands off a job, it'll show here. Direct links from the portal also open the editor."
        />
      ) : (
        <div className="bg-white rounded-xl border border-[color:var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--color-slate-50)] text-[color:var(--color-slate-500)] text-xs uppercase tracking-wide">
              <tr><th className="text-left px-4 py-2 font-bold">Job</th><th className="text-left px-4 py-2 font-bold">Pair</th><th className="text-left px-4 py-2 font-bold">Words</th><th className="text-left px-4 py-2 font-bold">Status</th><th className="text-left px-4 py-2 font-bold">Deadline</th><th className="text-left px-4 py-2 font-bold"></th></tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-[color:var(--color-border-soft)]">
                  <td className="px-4 py-2 mono">{j.reference}</td>
                  <td className="px-4 py-2">{j.source_lang} → {j.target_lang}</td>
                  <td className="px-4 py-2">{j.word_count.toLocaleString()}</td>
                  <td className="px-4 py-2 capitalize">{j.status.replace("_", " ")}</td>
                  <td className="px-4 py-2">{j.deadline ? new Date(j.deadline).toLocaleString() : "—"}</td>
                  <td className="px-4 py-2"><Link href={`/translator/editor/${j.id}`} className="text-[color:var(--color-teal-700)] font-semibold hover:underline">Open editor →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
