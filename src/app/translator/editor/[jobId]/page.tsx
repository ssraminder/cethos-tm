import Link from "next/link";
import { notFound } from "next/navigation";
import { getServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getExactMatchesForJob } from "@/lib/tm/match";
import { getTermHitsForJob } from "@/lib/termbase/hits";
import { EditorBodyClient } from "./EditorBodyClient";
import { HighlightedSource } from "./HighlightedSource";
import { RealtimeJobStatus } from "@/components/RealtimeJobStatus";
import { DeliverButton } from "./DeliverButton";
import { QaReviewPanel, type QaReviewFinding } from "./QaReviewPanel";
import { isRtlCode } from "@/lib/i18n/rtl";
import type { ImagePageView, ImageRegionView } from "./ImagePane";
import type { ImageRegionLocation, StoredImagePage } from "@/lib/jobs/image-extraction";
import { fieldChecks, fieldKind } from "@/lib/qa/field-rules";

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

  const { data: jobLangs } = await supabase
    .from("languages")
    .select("code, name")
    .in("code", [job.source_lang, job.target_lang]);
  const langNameByCode = new Map<string, string>(
    (jobLangs ?? []).map((l) => [(l as { code: string }).code, (l as { name: string }).name]),
  );
  const sourceLangName = langNameByCode.get(job.source_lang) ?? null;
  const targetLangName = langNameByCode.get(job.target_lang) ?? null;

  const readOnly = !isAssignedToMe || (job.status !== "assigned" && job.status !== "in_progress" && job.status !== "revision_requested");

  const jobClass: "production" | "test" = (job.job_class as "production" | "test" | null) ?? "production";
  const qaEnabledFlag: boolean = job.qa_enabled !== false;
  const inQaReview = job.status === "qa_review";
  const inPmReview = job.status === "pm_review";
  const inQaRunning = job.status === "qa_running";

  let q = supabase
    .from("segments")
    .select("id, seq, source_text, target_text, status, word_count, target_origin, meta")
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

  // Image jobs: signed page images plus one region per visible segment, for
  // the editor's image pane. Signed URLs last an hour; a reload renews them.
  let imageView: { pages: ImagePageView[]; regions: ImageRegionView[] } | null = null;
  const storedPages = ((job.meta as { image?: { pages?: StoredImagePage[] } } | null)?.image?.pages ?? []) as StoredImagePage[];
  if (job.source_format === "image" && storedPages.length > 0) {
    const { data: signed } = await supabase.storage
      .from("cat-source-files")
      .createSignedUrls(storedPages.map((pg) => pg.storage_path), 3600);
    const urlByPath = new Map<string, string>();
    for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    const pages: ImagePageView[] = storedPages
      .filter((pg) => urlByPath.has(pg.storage_path))
      .map((pg) => ({ page: pg.page, width: pg.width, height: pg.height, url: urlByPath.get(pg.storage_path)! }));
    const regions: ImageRegionView[] = [];
    for (const s of (segments ?? []) as Array<{ id: string; seq: number; source_text: string; target_text: string; meta: { location?: ImageRegionLocation } | null }>) {
      const loc = s.meta?.location;
      if (!loc || loc.kind !== "image_region") continue;
      // Field checks are recomputed on every load from the current text, so
      // they replace any stored copies from an earlier QA run (rule "field_*").
      const live = fieldChecks(s.source_text, s.target_text ?? "").map((c) => ({ rule: `field_${c.rule}`, severity: c.severity, message: c.message }));
      const stored = (findingsBySeg.get(s.id) ?? []).filter((f) => !f.rule.startsWith("field_"));
      findingsBySeg.set(s.id, [...live, ...stored]);
      regions.push({
        segmentId: s.id,
        seq: s.seq,
        page: loc.page,
        box: loc.box,
        confidence: loc.confidence,
        ocrText: loc.ocr_text,
        sourceText: s.source_text,
        kind: fieldKind(s.source_text),
        findings: (findingsBySeg.get(s.id) ?? []).map((f) => ({ severity: f.severity, message: f.message })),
      });
    }
    imageView = { pages, regions };
  }
  // Segment meta (tag inventories, locations) stays on the server.
  const clientSegments = (segments ?? []).map((s) => {
    const { meta, ...rest } = s as typeof s & { meta?: unknown };
    void meta;
    return rest;
  });

  const { data: attachedTms } = await supabase
    .from("job_resources")
    .select("resource_id")
    .eq("job_id", jobId)
    .eq("resource_type", "tm");

  // QA review-pane data: when job is in qa_review, load all unresolved
  // findings linked to a run (or deterministic ones).
  const reviewFindings: QaReviewFinding[] = [];
  if ((inQaReview || inPmReview) && segIdsForFindings.length > 0) {
    const segById = new Map<string, { seq: number; source: string; target: string }>();
    for (const s of (segments ?? []) as Array<{ id: string; seq: number; source_text: string; target_text: string }>) {
      segById.set(s.id, { seq: s.seq, source: s.source_text, target: s.target_text });
    }
    const { data: rf } = await supabase
      .from("qa_findings")
      .select("id, segment_id, rule, severity, category, message, source, suggested_target, ignored, resolved_at")
      .in("segment_id", segIdsForFindings)
      .eq("ignored", false)
      .is("resolved_at", null);
    for (const f of (rf ?? []) as Array<{
      id: string;
      segment_id: string;
      rule: string;
      severity: "critical" | "major" | "minor";
      category: string | null;
      message: string;
      source: string;
      suggested_target: string | null;
    }>) {
      const seg = segById.get(f.segment_id);
      if (!seg) continue;
      reviewFindings.push({
        id: f.id,
        segment_id: f.segment_id,
        segment_seq: seg.seq,
        source_text: seg.source,
        target_text: seg.target,
        rule: f.rule,
        severity: f.severity,
        category: f.category,
        message: f.message,
        source: f.source,
        suggested_target: f.suggested_target,
      });
    }
    reviewFindings.sort((a, b) => {
      const order: Record<string, number> = { critical: 0, major: 1, minor: 2 };
      const s = (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
      return s !== 0 ? s : a.segment_seq - b.segment_seq;
    });
  }

  const unresolvedCriticalCount = reviewFindings.filter((f) => f.severity === "critical").length;

  // Deliver/Run-QA buttons are shown to the assignee once all segments are
  // confirmed. Deliver is allowed from in_progress AND qa_review (so the
  // translator can deliver post-QA). Run QA is only relevant when QA is
  // enabled on the job.
  const deliverEnabled =
    isAssignedToMe &&
    !inQaRunning &&
    job.status !== "delivered" &&
    job.status !== "submitted" &&
    job.status !== "pm_review" &&
    job.status !== "approved" &&
    counts.confirmed === counts.total &&
    counts.total > 0;

  return (
    <div className="h-full flex flex-col min-h-0">
      <header className="h-14 bg-white border-b border-[color:var(--color-border)] px-4 flex items-center gap-4 shrink-0">
        <Link href={isStaff ? `/pm/jobs/${job.id}` : "/translator"} className="text-[color:var(--color-slate-500)] hover:text-[color:var(--color-navy)] text-sm">← {isStaff ? "Job" : "Inbox"}</Link>
        <div className="text-sm flex items-center gap-2">
          <span className="text-[color:var(--color-slate-500)]">Job</span>
          <span className="mono font-semibold text-[color:var(--color-navy)]">{job.reference}</span>
          <span className="text-[color:var(--color-slate-500)]">·</span>
          <span className="font-medium text-[color:var(--color-navy)]">{job.source_lang} → {job.target_lang}</span>
          {readOnly && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[color:var(--color-slate-200)] text-[color:var(--color-slate-700)]">Read-only</span>}
          {jobClass === "test" && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[color:var(--color-amber-100)] text-[color:var(--color-amber-800)]">Test</span>}
          {inQaRunning && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[color:var(--color-amber-100)] text-[color:var(--color-amber-800)]">QA running…</span>}
          {inQaReview && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[color:var(--color-rose-100)] text-[color:var(--color-rose-800)]">QA review</span>}
          {job.status === "pm_review" && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[color:var(--color-teal-100)] text-[color:var(--color-teal-800)]">PM review</span>}
          {job.status === "revision_requested" && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[color:var(--color-rose-100)] text-[color:var(--color-rose-800)]">Revision requested</span>}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <RealtimeJobStatus jobId={jobId} />
          <div className="text-xs text-[color:var(--color-slate-500)]">{counts.confirmed} / {counts.total} confirmed · {pct}%</div>
          <div className="w-32 h-1.5 rounded-full bg-[color:var(--color-slate-100)] overflow-hidden">
            <div className="h-full bg-[color:var(--color-emerald-500)]" style={{ width: `${pct}%` }} />
          </div>
          <DeliverButton
            jobId={jobId}
            jobClass={jobClass}
            qaEnabled={qaEnabledFlag}
            enabled={deliverEnabled}
            totalSegments={counts.total}
            inQaRunning={inQaRunning}
          />
        </div>
      </header>

      {(inQaReview || inPmReview) && (
        <QaReviewPanel
          jobId={jobId}
          findings={reviewFindings}
          unresolvedCriticalCount={unresolvedCriticalCount}
          targetLangCode={job.target_lang}
          targetRtl={isRtlCode(job.target_lang)}
        />
      )}

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

      <div className="flex-1 min-h-0">
        <EditorBodyClient
          jobId={jobId}
          readOnly={readOnly}
          showMt={isStaff}
          sourceLangLabel={sourceLangName ?? job.source_lang}
          targetLangLabel={targetLangName ?? job.target_lang}
          sourceLangCode={job.source_lang}
          targetLangCode={job.target_lang}
          sourceRtl={isRtlCode(job.source_lang)}
          targetRtl={isRtlCode(job.target_lang)}
          segments={clientSegments as never}
          image={imageView}
          highlightedSourceById={Object.fromEntries(
            (segments ?? []).map((s) => {
              const hits = termHits.get(s.id) ?? [];
              return [s.id, <HighlightedSource key={s.id} source={s.source_text} hits={hits} />];
            }),
          )}
          topMatchById={Object.fromEntries(
            (segments ?? []).map((s) => [s.id, exactMatches.get(s.id) ?? null]),
          )}
          termHitsById={Object.fromEntries(
            (segments ?? []).map((s) => [s.id, termHits.get(s.id) ?? []]),
          )}
          qaFindingsById={Object.fromEntries(
            (segments ?? []).map((s) => [s.id, findingsBySeg.get(s.id) ?? []]),
          )}
        />
      </div>
    </div>
  );
}
