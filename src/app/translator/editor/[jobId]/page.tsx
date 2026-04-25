import Link from "next/link";
import { notFound } from "next/navigation";
import { getServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { SegmentRow } from "./SegmentRow";

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
    .select("id, seq, source_text, target_text, status, word_count")
    .eq("job_id", jobId)
    .order("seq", { ascending: true });

  if (sp.filter && ["untranslated", "draft", "translated", "reviewed"].includes(sp.filter)) {
    q = q.eq("status", sp.filter);
  }

  const { data: segments } = await q;

  const counts = {
    total: job.segment_count,
    confirmed: 0,
    draft: 0,
  };
  const { data: stats } = await supabase
    .from("segments")
    .select("status")
    .eq("job_id", jobId);
  for (const s of stats ?? []) {
    if (s.status === "translated" || s.status === "reviewed") counts.confirmed++;
    else if (s.status === "draft") counts.draft++;
  }
  const pct = counts.total > 0 ? Math.round((counts.confirmed / counts.total) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg-app)" }}>
      {/* Top bar */}
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
          <div className="text-xs text-[color:var(--color-slate-500)]">{counts.confirmed} / {counts.total} confirmed · {pct}%</div>
          <div className="w-32 h-1.5 rounded-full bg-[color:var(--color-slate-100)] overflow-hidden">
            <div className="h-full bg-[color:var(--color-emerald-500)]" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      {/* Filter bar */}
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
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] min-h-0">
        {/* Segments column */}
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
              {(segments ?? []).map((s) => (
                <SegmentRow key={s.id} segment={s as never} readOnly={readOnly} />
              ))}
            </div>
          )}
        </div>

        {/* Right rail */}
        <aside className="overflow-y-auto bg-white p-5 hidden lg:block">
          <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-2">Active segment context</div>
          <div className="rounded-lg border border-dashed border-[color:var(--color-border)] p-6 text-sm text-[color:var(--color-slate-500)] text-center">
            TM matches, termbase hits, MT suggestions, comments, and QA findings will appear here when a segment is selected.
            <div className="mt-2 text-xs">(Wiring in the next chunk.)</div>
          </div>

          <div className="mt-6 text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-2">Job</div>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-[color:var(--color-slate-500)]">Status</span><span className="capitalize">{job.status.replace("_", " ")}</span></div>
            <div className="flex justify-between"><span className="text-[color:var(--color-slate-500)]">Words</span><span>{job.word_count.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-[color:var(--color-slate-500)]">Segments</span><span>{job.segment_count}</span></div>
            <div className="flex justify-between"><span className="text-[color:var(--color-slate-500)]">Source</span><span className="mono text-xs">{job.source_filename}</span></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
