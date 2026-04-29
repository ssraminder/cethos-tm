import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader, KpiCard } from "@/components/AppShell";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import { assignJobAction } from "./actions";
import { runQaAction } from "./qa-actions";
import { attachTmToJobAction, detachTmFromJobAction } from "@/app/admin/tm/actions";
import { attachTermbaseToJobAction, detachTermbaseFromJobAction } from "@/app/admin/termbases/actions";
import { RealtimeJobStatus } from "@/components/RealtimeJobStatus";

export default async function JobDetail({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ created?: string; error?: string; qa_critical?: string; qa_major?: string; qa_minor?: string }>;
}) {
  await requireRole(["admin", "pm"]);
  const { jobId } = await params;
  const sp = await searchParams;

  const supabase = await getServiceClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("*, projects(id, name, reference)")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) notFound();

  const { data: assignee } = job.assigned_to
    ? await supabase.from("profiles").select("full_name, email").eq("id", job.assigned_to).maybeSingle()
    : { data: null };

  // If this job belongs to a project with a vendor pool, narrow the dropdown.
  let translators: Array<{ id: string; full_name: string | null; email: string }> = [];
  if (job.project_id) {
    const { data: pv } = await supabase
      .from("project_vendors")
      .select("profiles!inner(id, full_name, email, role, status)")
      .eq("project_id", job.project_id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pool = (pv ?? []).map((r) => (r as any).profiles).filter((p: { status: string }) => p.status === "active");
    if (pool.length > 0) {
      translators = pool;
    }
  }
  if (translators.length === 0) {
    const { data: all } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("role", ["translator", "reviewer"])
      .eq("status", "active")
      .order("full_name");
    translators = all ?? [];
  }

  const { data: stats } = await supabase
    .from("segments")
    .select("status", { count: "exact" })
    .eq("job_id", jobId);

  const counts = (stats ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  // Attached TMs for this job + available TMs that match the language pair.
  const { data: attachedTms } = await supabase
    .from("job_resources")
    .select("resource_id, priority, translation_memories!inner(id, name, source_lang, target_lang)")
    .eq("job_id", jobId)
    .eq("resource_type", "tm")
    .order("priority", { ascending: true });

  const attachedIds = new Set((attachedTms ?? []).map((r) => r.resource_id));
  const { data: candidateTms } = await supabase
    .from("translation_memories")
    .select("id, name, source_lang, target_lang, scope")
    .eq("source_lang", job.source_lang)
    .eq("target_lang", job.target_lang)
    .order("created_at", { ascending: false });
  const availableTms = (candidateTms ?? []).filter((t) => !attachedIds.has(t.id));

  // Termbases that include both job languages
  const { data: attachedTbs } = await supabase
    .from("job_resources")
    .select("resource_id, priority, termbases!inner(id, name, languages)")
    .eq("job_id", jobId)
    .eq("resource_type", "termbase")
    .order("priority", { ascending: true });
  const attachedTbIds = new Set((attachedTbs ?? []).map((r) => r.resource_id));
  const { data: allTbs } = await supabase.from("termbases").select("id, name, languages, scope");
  const availableTbs = (allTbs ?? []).filter((t) => {
    const langs = t.languages ?? [];
    return langs.includes(job.source_lang) && langs.includes(job.target_lang) && !attachedTbIds.has(t.id);
  });

  // QA findings count
  const segIds = (await supabase.from("segments").select("id").eq("job_id", jobId)).data?.map((r) => r.id) ?? [];
  const { data: findings } = segIds.length > 0
    ? await supabase
        .from("qa_findings")
        .select("severity, ignored, resolved_at")
        .in("segment_id", segIds)
    : { data: [] };
  const openFindings = (findings ?? []).filter((f) => !f.ignored && !f.resolved_at);
  const qaCounts = { critical: 0, major: 0, minor: 0 };
  for (const f of openFindings) qaCounts[f.severity as keyof typeof qaCounts] = (qaCounts[f.severity as keyof typeof qaCounts] ?? 0) + 1;

  return (
    <>
      <PageHeader
        title={`Job ${job.reference}`}
        subtitle={`${(job as { projects?: { name: string } | null }).projects?.name ? `${(job as { projects?: { name: string } | null }).projects?.name} · ` : ""}${job.source_lang} → ${job.target_lang} · ${job.word_count.toLocaleString()} words · ${job.segment_count} segments`}
        actions={
          <div className="flex items-center gap-3">
            <RealtimeJobStatus jobId={job.id} />
            {job.assigned_to && (
              <Link href={`/translator/editor/${job.id}`} className="px-3 py-2 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] text-white">Open editor (read-only)</Link>
            )}
            <a href={`/pm/jobs/${job.id}/export?format=xliff`} className="px-3 py-2 text-sm font-semibold rounded-md border border-[color:var(--color-slate-200)] bg-white">Download XLIFF</a>
            <a href={`/pm/jobs/${job.id}/export?format=txt`} className="px-3 py-2 text-sm font-semibold rounded-md border border-[color:var(--color-slate-200)] bg-white">Download TXT</a>
            {job.source_format === "docx" && (
              <a href={`/api/jobs/${job.id}/export-docx`} className="px-3 py-2 text-sm font-semibold rounded-md border border-[color:var(--color-slate-200)] bg-white">Download Word</a>
            )}
            {job.source_format === "xlsx" && (
              <a href={`/api/jobs/${job.id}/export-xlsx`} className="px-3 py-2 text-sm font-semibold rounded-md border border-[color:var(--color-slate-200)] bg-white">Download Excel</a>
            )}
            {job.source_format === "pptx" && (
              <a href={`/api/jobs/${job.id}/export-pptx`} className="px-3 py-2 text-sm font-semibold rounded-md border border-[color:var(--color-slate-200)] bg-white">Download PowerPoint</a>
            )}
            {job.source_format === "json" && (
              <a href={`/api/jobs/${job.id}/export-json`} className="px-3 py-2 text-sm font-semibold rounded-md border border-[color:var(--color-slate-200)] bg-white">Download JSON</a>
            )}
          </div>
        }
      />

      {sp.created && (
        <div className="mb-4 rounded-md border border-[color:var(--color-emerald-100)] bg-[color:var(--color-emerald-50)] text-[color:var(--color-emerald-700)] px-3 py-2 text-sm">
          Job created — {job.segment_count} segments ready.
        </div>
      )}
      {(sp.qa_critical || sp.qa_major || sp.qa_minor) && (
        <div className="mb-4 rounded-md border border-[color:var(--color-amber-100)] bg-[color:var(--color-amber-50)] text-[color:var(--color-amber-600)] px-3 py-2 text-sm">
          QA run complete — {sp.qa_critical} critical, {sp.qa_major} major, {sp.qa_minor} minor findings.
        </div>
      )}
      {sp.error && (
        <div className="mb-4 rounded-md border border-[color:var(--color-rose-100)] bg-[color:var(--color-rose-50)] text-[color:var(--color-rose-600)] px-3 py-2 text-sm">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <KpiCard label="Status" value={job.status.replace("_", " ")} />
        <KpiCard label="Untranslated" value={String(counts["untranslated"] ?? 0)} />
        <KpiCard label="Translated" value={String((counts["translated"] ?? 0) + (counts["reviewed"] ?? 0))} />
        <KpiCard label="QA critical" value={String(qaCounts.critical)} hint={`${qaCounts.major} major, ${qaCounts.minor} minor`} />
        <div className="bg-white rounded-xl border border-[color:var(--color-border)] p-4 shadow-[var(--shadow-soft)] flex flex-col justify-between">
          <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)]">QA</div>
          <form action={runQaAction}>
            <input type="hidden" name="job_id" value={job.id} />
            <button type="submit" className="mt-2 w-full px-3 py-2 text-sm font-semibold rounded-md bg-[color:var(--color-amber-500)] hover:bg-[color:var(--color-amber-600)] text-white">Run QA</button>
          </form>
        </div>
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

      <div className="mt-6 bg-white rounded-xl border border-[color:var(--color-border)] p-5">
        <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-3">Translation memories</div>

        {(attachedTms ?? []).length === 0 ? (
          <p className="text-sm text-[color:var(--color-slate-500)] mb-3">No TMs attached. The editor will run without leverage.</p>
        ) : (
          <ul className="space-y-1.5 mb-4">
            {attachedTms!.map((r) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const tm = (r as any).translation_memories;
              return (
                <li key={r.resource_id} className="flex items-center justify-between rounded-md border border-[color:var(--color-border)] p-2">
                  <div className="text-sm">
                    <span className="font-semibold text-[color:var(--color-navy)]">{tm.name}</span>
                    <span className="ml-2 text-[10px] text-[color:var(--color-slate-500)] mono uppercase">{tm.source_lang} → {tm.target_lang}</span>
                    <span className="ml-2 text-[10px] text-[color:var(--color-slate-500)]">priority {r.priority}</span>
                  </div>
                  <form action={detachTmFromJobAction}>
                    <input type="hidden" name="job_id" value={job.id} />
                    <input type="hidden" name="tm_id" value={r.resource_id} />
                    <button type="submit" className="text-xs font-semibold text-[color:var(--color-rose-600)] hover:underline">Detach</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        {availableTms.length === 0 ? (
          <p className="text-xs text-[color:var(--color-slate-500)]">No additional TMs available for this language pair. <Link href="/admin/tm/new" className="text-[color:var(--color-teal-700)] font-semibold hover:underline">Create one →</Link></p>
        ) : (
          <form action={attachTmToJobAction} className="flex items-end gap-2">
            <input type="hidden" name="job_id" value={job.id} />
            <div className="flex-1">
              <label className="block text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-1">Attach TM</label>
              <select name="tm_id" required className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2 text-sm">
                {availableTms.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.scope})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-1">Priority</label>
              <input type="number" name="priority" defaultValue={100} min={1} max={1000} className="w-24 rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2 text-sm" />
            </div>
            <button type="submit" className="px-3 py-2 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] text-white">Attach</button>
          </form>
        )}
      </div>

      <div className="mt-4 bg-white rounded-xl border border-[color:var(--color-border)] p-5">
        <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-3">Termbases</div>

        {(attachedTbs ?? []).length === 0 ? (
          <p className="text-sm text-[color:var(--color-slate-500)] mb-3">No termbases attached.</p>
        ) : (
          <ul className="space-y-1.5 mb-4">
            {attachedTbs!.map((r) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const tb = (r as any).termbases;
              return (
                <li key={r.resource_id} className="flex items-center justify-between rounded-md border border-[color:var(--color-border)] p-2">
                  <div className="text-sm">
                    <span className="font-semibold text-[color:var(--color-navy)]">{tb.name}</span>
                    <span className="ml-2 text-[10px] text-[color:var(--color-slate-500)] mono uppercase">{(tb.languages ?? []).join(", ")}</span>
                  </div>
                  <form action={detachTermbaseFromJobAction}>
                    <input type="hidden" name="job_id" value={job.id} />
                    <input type="hidden" name="tb_id" value={r.resource_id} />
                    <button type="submit" className="text-xs font-semibold text-[color:var(--color-rose-600)] hover:underline">Detach</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        {availableTbs.length === 0 ? (
          <p className="text-xs text-[color:var(--color-slate-500)]">No termbases cover this pair. <Link href="/admin/termbases/new" className="text-[color:var(--color-teal-700)] font-semibold hover:underline">Create one →</Link></p>
        ) : (
          <form action={attachTermbaseToJobAction} className="flex items-end gap-2">
            <input type="hidden" name="job_id" value={job.id} />
            <div className="flex-1">
              <label className="block text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-1">Attach termbase</label>
              <select name="tb_id" required className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2 text-sm">
                {availableTbs.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.scope})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-1">Priority</label>
              <input type="number" name="priority" defaultValue={100} min={1} max={1000} className="w-24 rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2 text-sm" />
            </div>
            <button type="submit" className="px-3 py-2 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] text-white">Attach</button>
          </form>
        )}
      </div>
    </>
  );
}
