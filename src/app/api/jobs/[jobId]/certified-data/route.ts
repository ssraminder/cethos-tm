import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/api-keys";
import { getServiceClient } from "@/lib/supabase/server";
import { audit } from "@/lib/auth/audit";
import type { ImageRegionLocation, StoredImagePage } from "@/lib/jobs/image-extraction";

const STORAGE_BUCKET = "cat-source-files";
const SIGNED_URL_SECONDS = 600;

/**
 * GET /api/jobs/:jobId/certified-data
 *
 * What the portal needs to assemble the certified translation document for
 * an image job: the translated fields in reading order, short-lived links to
 * the scanned pages of the original, and the translator's comments.
 *
 * Authenticated by Bearer API key with scope=tms_ingest (the same key the
 * portal uses to create the job). Returns 409 when the job is not an image job.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const header = req.headers.get("authorization") ?? "";
  const key = header.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
  if (!key) return NextResponse.json({ error: "Missing Bearer token" }, { status: 401 });
  const record = await verifyApiKey(key, "tms_ingest");
  if (!record) return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 });

  const { jobId } = await ctx.params;
  const supabase = await getServiceClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, reference, status, source_lang, target_lang, source_format, meta")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.source_format !== "image") {
    return NextResponse.json({ error: "Not an image job" }, { status: 409 });
  }

  const { data: segs } = await supabase
    .from("segments")
    .select("seq, source_text, target_text, status, meta")
    .eq("job_id", jobId)
    .order("seq", { ascending: true });

  const fields: Array<{ seq: number; page: number; target: string; confirmed: boolean }> = [];
  const auto: string[] = [];
  for (const s of (segs ?? []) as Array<{
    seq: number;
    source_text: string;
    target_text: string | null;
    status: string;
    meta: { location?: ImageRegionLocation; illegible?: unknown; source_corrected?: unknown; excluded?: unknown } | null;
  }>) {
    const loc = s.meta?.location;
    if (!loc || loc.kind !== "image_region") continue;
    if (s.meta?.excluded) {
      auto.push(`Field ${s.seq}: left out as not part of the document (read as "${s.source_text}").`);
      continue;
    }
    fields.push({
      seq: s.seq,
      page: loc.page,
      target: s.target_text ?? "",
      confirmed: s.status === "translated" || s.status === "reviewed" || s.status === "locked",
    });
    if (s.meta?.illegible) auto.push(`Field ${s.seq}: marked illegible by the translator.`);
    if (s.meta?.source_corrected && loc.ocr_text !== s.source_text) {
      auto.push(`Field ${s.seq}: the source reading was corrected from "${loc.ocr_text}" to "${s.source_text}".`);
    }
  }

  const meta = (job.meta ?? {}) as { image?: { pages?: StoredImagePage[] }; translator_comments?: string };
  const stored = meta.image?.pages ?? [];
  const { data: signed } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrls(stored.map((p) => p.storage_path), SIGNED_URL_SECONDS);
  const urlByPath = new Map<string, string>();
  for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
  const pages = stored
    .filter((p) => urlByPath.has(p.storage_path))
    .map((p) => ({ page: p.page, width: p.width, height: p.height, url: urlByPath.get(p.storage_path)! }));
  if (pages.length !== stored.length) {
    return NextResponse.json({ error: "Page images of the original are missing" }, { status: 500 });
  }

  // The translator's own notes first (one paragraph per line), then the
  // notes the editor recorded automatically.
  const typed = (meta.translator_comments ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  await audit({
    category: "job",
    action: "certified_data_fetched_api",
    actorId: record.created_by,
    targetType: "job",
    targetId: job.id,
    meta: { api_key_id: record.id, fields: fields.length, pages: pages.length },
  });

  return NextResponse.json({
    job: {
      id: job.id,
      reference: job.reference,
      status: job.status,
      source_lang: job.source_lang,
      target_lang: job.target_lang,
      source_format: job.source_format,
    },
    fields,
    pages,
    comments: [...typed, ...auto],
  });
}
