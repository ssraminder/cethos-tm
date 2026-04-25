import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader, KpiCard } from "@/components/AppShell";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import { assignJobAction } from "./actions";

export default async function JobDetail({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  await requireRole(["admin", "pm"]);
  const { jobId } = await params;
  const sp = await searchParams;

  const supabase = await getServiceClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) notFound();

  const { data: assignee } = job.assigned_to
    ? await supabase.from("profiles").select("full_name, email").eq("id", job.assigned_to).maybeSingle()
    : { data: null };

  const { data: translators } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("role", ["translator", "reviewer"])
    .eq("status", "active")
    .order("full_name");

  const { data: stats } = await supabase
    .from("segments")
    .select("status", { count: "exact" })
    .eq("job_id", jobId);

  const counts = (stats ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title={`Job ${job.reference}`}
        subtitle={`${job.source_lang} → ${job.target_lang} · ${job.word_count.toLocaleString()} words · ${job.segment_count} segments`}
        actions={
          job.assigned_to ? (
            <Link href={`/translator/editor/${job.id}`} className="px-3 py-2 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] text-white">Open editor (read-only)</Link>
          ) : null
        }
      />

      {sp.created && (
        <div className="mb-4 rounded-md border border-[color:var(--color-emerald-100)] bg-[color:var(--color-emerald-50)] text-[color:var(--color-emerald-700)] px-3 py-2 text-sm">
          Job created — {job.segment_count} segments ready.
        </div>
      )}
      {sp.error && (
        <div className="mb-4 rounded-md border border-[color:var(--color-rose-100)] bg-[color:var(--color-rose-50)] text-[color:var(--color-rose-600)] px-3 py-2 text-sm">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Status" value={job.status.replace("_", " ")} />
        <KpiCard label="Untranslated" value={String(counts["untranslated"] ?? 0)} />
        <KpiCard label="Translated" value={String((counts["translated"] ?? 0) + (counts["reviewed"] ?? 0))} />
        <KpiCard label="Confirmed" value={String(counts["reviewed"] ?? 0)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[color:var(--color-border)] p-5">
          <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-3">Assignment</div>
          {assignee ? (
            <div className="text-sm">
              <div className="font-semibold text-[color:var(--color-navy)]">{assignee.full_name || assignee.email}</div>
              <div className="text-[color:var(--color-slate-500)]">{assignee.email}</div>
            </div>
          ) : (
            <div className="text-sm text-[color:var(--color-slate-500)]">Unassigned (draft).</div>
          )}
          <form action={assignJobAction} className="mt-4 flex items-center gap-2">
            <input type="hidden" name="job_id" value={job.id} />
            <select name="assigned_to" defaultValue={job.assigned_to ?? ""} className="flex-1 rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2 text-sm">
              <option value="">— Unassign —</option>
              {translators?.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name || t.email}</option>
              ))}
            </select>
            <button type="submit" className="px-3 py-2 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] text-white">Update</button>
          </form>
        </div>

        <div className="bg-white rounded-xl border border-[color:var(--color-border)] p-5">
          <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-3">Source file</div>
          <div className="text-sm mono">{job.source_filename}</div>
          <div className="text-xs text-[color:var(--color-slate-500)] mt-1">{job.source_format} · {job.source_storage_path}</div>
          <div className="text-xs text-[color:var(--color-slate-500)] mt-3">Created {new Date(job.created_at).toLocaleString()}</div>
        </div>
      </div>
    </>
  );
}
