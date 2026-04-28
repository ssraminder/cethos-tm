import Link from "next/link";
import { notFound } from "next/navigation";
import { getServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getExactMatchesForJob } from "@/lib/tm/match";
import { getTermHitsForJob } from "@/lib/termbase/hits";
import { SegmentRow } from "./SegmentRow";
import { HighlightedSource } from "./HighlightedSource";
import { RealtimeJobStatus } from "@/components/RealtimeJobStatus";

export default async function EditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { jobId } = await params;
  const sp = await searchParams;
  const me = await getCurrentUser();

  const supabase = await getServiceClient();
  const { data: job } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) notFound();

  const isAssignedToMe = job.assigned_to === me.id;
  const isStaff = me.role === "admin" || me.role === "pm";
  if (!isAssignedToMe && !isStaff && job.reviewer_id !== me.id) notFound();

  const readOnly = !isAssignedToMe || (job.status !== "assigned" && job.status !== "in_progress");

  let q = supabase
    .from("segments")
    .select("id, seq, source_text, target_text, status, word_count, target_origin")
    .eq("job_id", jobId)
    .order("seq", { ascending: true });

  if (sp.filter && ["untranslated", "draft", "translated", "reviewed"].includes(sp.filter)) {
    q = q.eq("status", sp.filter);
  }

  const { data: segments } = await q;

  const { data: stats } = await supabase
    .from("segments")
    .select("status")
    .eq("job_id", jobId);
  const counts = { total: job.segment_count, confirmed: 0, draft: 0 };
  for (const s of stats ?? []) {
    if (s.status === "translated" || s.status === "reviewed") counts.confirmed++;
    else if (s.status === "draft") counts.draft++;
  }
  const pct = counts.total > 0 ? Math.round((counts.confirmed / counts.total) * 100) : 0;

  // Pre-compute leverage data in parallel round-trips.
  const segIdsForFindings = ((await supabase.from("segments").select("id").eq("job_id", jobId)).data ?? []).map((r) => r.id);
  const [exactMatches, termHits, findingsRes] = await Promise.all([
    getExactMatchesForJob(jobId),
    getTermHitsForJob(jobId),
    segIdsForFindings.length > 0
      ? supabase
          .from("qa_findings")
          .select("segment_id, rule, severity, message, ignored, resolved_at")
          .in("segment_id", segIdsForFindings)
      : Promise.resolve({ data: [] }),
  ]);
  const findingsBySeg = new Map<string, Array<{ rule: string; severity: string; message: string }>>();
  for (const f of (findingsRes.data ?? []) as Array<{ segment_id: string; rule: string; severity: string; message: string; ignored: boolean; resolved_at: string | null }>) {
    if (f.ignored || f.resolved_at) continue;
    const arr = findingsBySeg.get(f.segment_id) ?? [];
    arr.push({ rule: f.rule, severity: f.severity, message: f.message });
    findingsBySeg.set(f.segment_id, arr);
  }

  const { data: attachedTms } = await supabase
    .from("job_resources")
    .select("resource_id, priority, translation_memories!inner(name, source_lang, target_lang)")
    .eq("job_id", jobId)
    .eq("resource_type", "tm")
    .order("priority", { ascending: true });

  const { data: attachedTbs } = await supabase
    .from("job_resources")
    .select("resource_id, priority, termbases!inner(name, languages)")
    .eq("job_id", jobId)
    .eq("resource_type", "termbase")
    .order("priority", { ascending: true });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg-app)" }}>
      <header className="h-14 bg-white border-b border-[color:var(--color-border)] px-4 flex items-center gap-4">
        <Link href={isStaff ? `/pm/jobs/${job.id}` : "/translator"} className="text-[color:var(--color-slate-500)] hover:text-[color:var(--color-navy)] text-sm">← {isStaff ? "Job" : "Inbox"}</Link>
        <div className="text-sm flex items-center gap-2">
          <span className="text-[color:var(--color-slate-500)]">Job</span>
          <span className="mono font-semibold text-[color:var(--color-navy)]">{job.reference}</span>
          <span className="text-[color:var(--color-slate-500)]">·</span>
          <span className="font-medium text-[color:var(--color-navy)]">{job.source_lang} → {job.target_lang}</span>
          {readOnly && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[color:var(--color-slate-200)] text-[color:var(--color-slate-700)]">Read-only</span>}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <RealtimeJobStatus jobId={jobId} />
          <div className="text-xs text-[color:var(--color-slate-500)]">{counts.confirmed} / {counts.total} confirmed · {pct}%</div>
          <div className="w-32 h-1.5 rounded-full bg-[color:var(--color-slate-100)] overflow-hidden">
            <div className="h-full bg-[color:var(--color-emerald-500)]" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      <div className="px-4 py-2 bg-white border-b border-[color:var(--color-border-soft)] flex items-center gap-2 text-xs">
        <span className="text-[color:var(--color-slate-500)] font-semibold uppercase tracking-wide">Filter:</span>
        {([
          { v: "", label: "All" },
          { v: "untranslated", label: "Open" },
          { v: "draft", label: "Draft" },
          { v: "translated", label: "Confirmed" },
        ] as const).map((f) => (
          <Link
            key={f.v}
            href={`/translator/editor/${jobId}${f.v ? `?filter=${f.v}` : ""}`}
            className={[
              "px-2.5 py-1 rounded-full font-semibold",
              (sp.filter ?? "") === f.v
                ? "bg-[color:var(--color-bg-blue)] text-[color:var(--color-teal-700)]"
                : "text-[color:var(--color-slate-600)] hover:bg-[color:var(--color-slate-100)]",
            ].join(" ")}
          >
            {f.label}
          </Link>
        ))}
        <span className="ml-auto text-[color:var(--color-slate-500)]">
          {attachedTms && attachedTms.length > 0
            ? `${attachedTms.length} TM${attachedTms.length === 1 ? "" : "s"} attached · ${exactMatches.size} exact match${exactMatches.size === 1 ? "" : "es"}`
            : "No TMs attached — leverage panel disabled"}
        </span>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] min-h-0">
        <div className="overflow-y-auto bg-white border-r border-[color:var(--color-border)]">
          {(segments ?? []).length === 0 ? (
            <div className="p-12 text-center text-sm text-[color:var(--color-slate-500)]">
              No segments match this filter.
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-[40px_36px_1fr_1fr] gap-3 px-3 py-2 bg-[color:var(--color-slate-50)] text-[10px] uppercase font-bold tracking-wide text-[color:var(--color-slate-500)] sticky top-0 z-10 border-b border-[color:var(--color-border)]">
                <div>#</div>
                <div></div>
                <div>Source</div>
                <div>Target</div>
              </div>
              {(segments ?? []).map((s) => {
                const hits = termHits.get(s.id) ?? [];
                return (
                  <SegmentRow
                    key={s.id}
                    segment={s as never}
                    readOnly={readOnly}
                    jobId={jobId}
                    topMatch={exactMatches.get(s.id) ?? null}
                    termHits={hits}
                    highlightedSource={<HighlightedSource source={s.source_text} hits={hits} />}
                    qaFindings={findingsBySeg.get(s.id) ?? []}
                    showMt={isStaff}
                  />
                );
              })}
            </div>
          )}
        </div>

        <aside className="overflow-y-auto bg-white p-5 hidden lg:block">
          <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-2">Attached translation memories</div>
          {!attachedTms || attachedTms.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[color:var(--color-border)] p-4 text-sm text-[color:var(--color-slate-500)]">
              No TMs attached. {isStaff && (
                <Link href={`/pm/jobs/${job.id}`} className="text-[color:var(--color-teal-700)] font-semibold hover:underline ml-1">
                  Attach from job page →
                </Link>
              )}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {attachedTms.map((r) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const tm = (r as any).translation_memories;
                return (
                  <li key={r.resource_id} className="rounded-md border border-[color:var(--color-border)] p-2 text-sm">
                    <div className="font-semibold text-[color:var(--color-navy)] truncate">{tm.name}</div>
                    <div className="text-[10px] text-[color:var(--color-slate-500)] mono">{tm.source_lang} → {tm.target_lang} · priority {r.priority}</div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-6 text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-2">Attached termbases</div>
          {!attachedTbs || attachedTbs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[color:var(--color-border)] p-3 text-xs text-[color:var(--color-slate-500)] mb-4">
              No termbases attached.
            </div>
          ) : (
            <ul className="space-y-1.5 mb-4">
              {attachedTbs.map((r) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const tb = (r as any).termbases;
                return (
                  <li key={r.resource_id} className="rounded-md border border-[color:var(--color-border)] p-2 text-sm">
                    <div className="font-semibold text-[color:var(--color-navy)] truncate">{tb.name}</div>
                    <div className="text-[10px] text-[color:var(--color-slate-500)] mono">{(tb.languages ?? []).join(", ")}</div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-2">Job</div>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-[color:var(--color-slate-500)]">Status</span><span className="capitalize">{job.status.replace("_", " ")}</span></div>
            <div className="flex justify-between"><span className="text-[color:var(--color-slate-500)]">Words</span><span>{job.word_count.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-[color:var(--color-slate-500)]">Segments</span><span>{job.segment_count}</span></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
