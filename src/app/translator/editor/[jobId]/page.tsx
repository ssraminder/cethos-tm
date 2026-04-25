import { notFound } from "next/navigation";
import { getServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function EditorPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const me = await getCurrentUser();
  const supabase = await getServiceClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) notFound();
  if (job.assigned_to !== me.id && me.role !== "admin" && me.role !== "pm") notFound();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg-app)" }}>
      <div className="h-14 bg-white border-b border-[color:var(--color-border)] px-4 flex items-center gap-4">
        <a href="/translator" className="text-[color:var(--color-slate-500)] hover:text-[color:var(--color-navy)]">← Inbox</a>
        <div className="text-sm">
          <span className="text-[color:var(--color-slate-500)]">Job</span>
          <span className="mx-2 mono font-semibold">{job.reference}</span>
          <span className="text-[color:var(--color-slate-500)]">{job.source_lang} → {job.target_lang}</span>
        </div>
        <div className="flex-1" />
        <span className="text-xs text-[color:var(--color-slate-500)]">0 / {job.segment_count} segments</span>
        <button className="px-3 py-1.5 text-sm font-semibold rounded-md border border-[color:var(--color-slate-200)] bg-white">Run QA</button>
        <button className="px-3 py-1.5 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] text-white opacity-50 cursor-not-allowed" disabled>Submit</button>
      </div>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[60%_40%]">
        <div className="border-r border-[color:var(--color-border)] p-6">
          <div className="bg-white rounded-xl border border-dashed border-[color:var(--color-border)] p-8 text-center">
            <h2 className="font-bold text-[color:var(--color-navy)]">Segment grid</h2>
            <p className="text-sm text-[color:var(--color-slate-500)] mt-1 max-w-md mx-auto">
              Source segments will render here once the job's source file is ingested and segmented.
              Each row gets a TM-match badge, status, QA, and inline tags.
            </p>
          </div>
        </div>
        <div className="p-6">
          <div className="bg-white rounded-xl border border-dashed border-[color:var(--color-border)] p-8 text-center">
            <h2 className="font-bold text-[color:var(--color-navy)]">TM · TB · MT · QA</h2>
            <p className="text-sm text-[color:var(--color-slate-500)] mt-1 max-w-md mx-auto">
              Context panel for the active segment — TM matches with diff, termbase hits, MT suggestions, QA findings, and comments.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
