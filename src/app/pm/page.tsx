import Link from "next/link";
import { PageHeader, KpiCard } from "@/components/AppShell";
import { getServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["draft", "assigned", "in_progress", "review", "qa_running", "qa_review"];

export default async function PmDashboard() {
  const supabase = await getServiceClient();

  const [activeRes, qaRes, overdueRes, jobsRes] = await Promise.all([
    supabase.from("jobs").select("id", { count: "exact", head: true }).in("status", ACTIVE_STATUSES),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "qa_review"),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .lt("deadline", new Date().toISOString())
      .in("status", ACTIVE_STATUSES),
    supabase
      .from("jobs")
      .select("id, reference, status, deadline, target_lang, source_lang, word_count")
      .in("status", ACTIVE_STATUSES)
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(8),
  ]);

  const active = activeRes.count ?? 0;
  const awaitingQa = qaRes.count ?? 0;
  const overdue = overdueRes.count ?? 0;
  const jobs = jobsRes.data ?? [];

  // Pipeline counts.
  const pipeline: Record<string, number> = {};
  for (const s of ACTIVE_STATUSES) pipeline[s] = 0;
  const { data: pipelineRows } = await supabase
    .from("jobs")
    .select("status")
    .in("status", ACTIVE_STATUSES);
  for (const r of (pipelineRows ?? []) as Array<{ status: string }>) {
    pipeline[r.status] = (pipeline[r.status] ?? 0) + 1;
  }

  // QA findings by job (top 5).
  const { data: findingRows } = await supabase
    .from("qa_findings")
    .select("segment_id, severity, ignored, resolved_at, segments!inner(job_id)")
    .eq("ignored", false)
    .is("resolved_at", null);
  const findingsByJob = new Map<string, { critical: number; major: number }>();
  for (const f of (findingRows ?? []) as Array<{
    severity: string;
    segments: { job_id: string } | { job_id: string }[];
  }>) {
    const seg = Array.isArray(f.segments) ? f.segments[0] : f.segments;
    const jobId = seg?.job_id;
    if (!jobId) continue;
    const cur = findingsByJob.get(jobId) ?? { critical: 0, major: 0 };
    if (f.severity === "critical") cur.critical += 1;
    else if (f.severity === "major") cur.major += 1;
    findingsByJob.set(jobId, cur);
  }
  const findingsTopJobs = [...findingsByJob.entries()]
    .map(([jobId, c]) => ({ jobId, ...c, total: c.critical * 10 + c.major }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const refsForFindings = findingsTopJobs.length > 0
    ? (
      await supabase
        .from("jobs")
        .select("id, reference")
        .in(
          "id",
          findingsTopJobs.map((x) => x.jobId),
        )
    ).data ?? []
    : [];
  const refByJobId = new Map<string, string>();
  for (const r of refsForFindings as Array<{ id: string; reference: string }>) {
    refByJobId.set(r.id, r.reference);
  }

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Active jobs, translator workload, and alerts." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Active jobs" value={String(active)} hint="Not closed or delivered" />
        <KpiCard
          label="Awaiting QA review"
          value={String(awaitingQa)}
          hint="Translator triaging findings"
        />
        <KpiCard
          label="Overdue"
          value={String(overdue)}
          hint={overdue > 0 ? "Past deadline — chase up" : "All deadlines clear"}
        />
        <KpiCard label="Recent jobs" value={String(jobs.length)} hint="Top 8 by deadline" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg bg-white border border-[color:var(--color-border)] p-4">
          <div className="text-sm font-bold text-[color:var(--color-navy)] mb-3">Job pipeline</div>
          <ul className="space-y-1.5 text-sm">
            {ACTIVE_STATUSES.map((s) => (
              <li key={s} className="flex items-center justify-between">
                <span className="capitalize text-[color:var(--color-slate-600)]">
                  {s.replace("_", " ")}
                </span>
                <span className="mono font-semibold text-[color:var(--color-navy)]">
                  {pipeline[s] ?? 0}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg bg-white border border-[color:var(--color-border)] p-4">
          <div className="text-sm font-bold text-[color:var(--color-navy)] mb-3">QA issues by job</div>
          {findingsTopJobs.length === 0 ? (
            <div className="text-xs text-[color:var(--color-slate-500)] italic">
              No open findings across active jobs.
            </div>
          ) : (
            <ul className="space-y-2 text-sm">
              {findingsTopJobs.map((j) => (
                <li key={j.jobId} className="flex items-center justify-between">
                  <Link
                    href={`/pm/jobs/${j.jobId}`}
                    className="mono text-[color:var(--color-teal-700)] hover:underline"
                  >
                    {refByJobId.get(j.jobId) ?? j.jobId.slice(0, 8)}
                  </Link>
                  <span className="text-xs">
                    {j.critical > 0 && (
                      <span className="text-[color:var(--color-rose-600)] font-semibold">
                        {j.critical} crit
                      </span>
                    )}
                    {j.critical > 0 && j.major > 0 && (
                      <span className="text-[color:var(--color-slate-400)] mx-1">·</span>
                    )}
                    {j.major > 0 && (
                      <span className="text-[color:var(--color-amber-700)] font-semibold">
                        {j.major} maj
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {jobs.length > 0 && (
        <div className="mt-6 rounded-lg bg-white border border-[color:var(--color-border)] p-4">
          <div className="text-sm font-bold text-[color:var(--color-navy)] mb-3">
            Upcoming deadlines
          </div>
          <ul className="divide-y divide-[color:var(--color-border-soft)] text-sm">
            {jobs.map((j) => (
              <li
                key={j.id}
                className="py-2 flex items-center gap-3"
              >
                <Link
                  href={`/pm/jobs/${j.id}`}
                  className="mono text-[color:var(--color-teal-700)] hover:underline w-32"
                >
                  {j.reference}
                </Link>
                <span className="text-[color:var(--color-slate-600)] mono text-xs w-28">
                  {j.source_lang} → {j.target_lang}
                </span>
                <span className="text-[color:var(--color-slate-600)] text-xs w-16">
                  {(j.word_count ?? 0).toLocaleString()} w
                </span>
                <span className="text-[color:var(--color-slate-500)] capitalize text-xs w-24">
                  {j.status.replace("_", " ")}
                </span>
                <span className="ml-auto text-xs text-[color:var(--color-slate-500)]">
                  {j.deadline ? new Date(j.deadline).toLocaleString() : "no deadline"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
