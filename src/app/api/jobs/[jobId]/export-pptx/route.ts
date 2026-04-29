import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getServiceClient } from "@/lib/supabase/server";
import { exportPptxBuffer } from "@/lib/jobs/pptx-extraction";
import type { OoxmlTag } from "@/lib/jobs/ooxml-tags";

const STORAGE_BUCKET = "cat-source-files";

export async function GET(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const me = await getCurrentUser();
  const { jobId } = await ctx.params;

  const supabase = await getServiceClient();
  const { data: job } = await supabase
    .from("jobs")
    .select(
      "id, reference, source_filename, source_format, source_storage_path, target_lang, assigned_to, reviewer_id",
    )
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const isStaff = me.role === "admin" || me.role === "pm";
  if (!isStaff && job.assigned_to !== me.id && job.reviewer_id !== me.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (job.source_format !== "pptx") {
    return NextResponse.json(
      { error: `Cannot export PPTX from a ${job.source_format} source` },
      { status: 400 },
    );
  }
  if (!job.source_storage_path) {
    return NextResponse.json({ error: "Source file no longer in storage" }, { status: 400 });
  }

  const { data: file, error: dlErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(job.source_storage_path);
  if (dlErr || !file) {
    return NextResponse.json(
      { error: `Could not download source: ${dlErr?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  const sourceBuffer = Buffer.from(await file.arrayBuffer());

  const { data: segs } = await supabase
    .from("segments")
    .select("seq, source_text, target_text, meta")
    .eq("job_id", jobId)
    .order("seq", { ascending: true });
  if (!segs) {
    return NextResponse.json({ error: "No segments found" }, { status: 400 });
  }

  const translatedSegments = (segs as Array<{
    source_text: string;
    target_text: string;
    meta: Record<string, unknown> | null;
  }>)
    .filter((s) => s.meta && (s.meta as Record<string, unknown>).location)
    .map((s) => ({
      source_text: s.source_text,
      target_text: s.target_text,
      tags: ((s.meta as Record<string, unknown>).tags ?? []) as OoxmlTag[],
      location: (s.meta as Record<string, unknown>).location as { file: string; para: number },
    }));

  const buffer = await exportPptxBuffer(sourceBuffer, translatedSegments);

  const baseName = job.source_filename.replace(/\.pptx$/i, "");
  const filename = `${baseName}-${job.target_lang}.pptx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
