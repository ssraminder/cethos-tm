import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import { buildXliff12 } from "@/lib/xliff/parse";

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  await requireRole(["admin", "pm"]);
  const { jobId } = await params;
  const fmt = (req.nextUrl.searchParams.get("format") || "xliff").toLowerCase();

  const supabase = await getServiceClient();
  const { data: job } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) return new NextResponse("Job not found", { status: 404 });

  const { data: segments } = await supabase
    .from("segments")
    .select("id, seq, source_text, target_text, status, meta")
    .eq("job_id", jobId)
    .order("seq", { ascending: true });

  if (fmt === "xliff" || fmt === "xlf") {
    const xml = buildXliff12({
      source_lang: job.source_lang,
      target_lang: job.target_lang,
      original: job.source_filename || `${job.reference}.txt`,
      segments: (segments ?? []).map((s) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tags = (s.meta as any)?.tags as Array<{ id: number; original_xml: string; kind: "open" | "close" | "empty" }> | undefined;
        return {
          id: String(s.seq),
          source_text: s.source_text,
          target_text: s.target_text,
          state: s.status === "translated" || s.status === "reviewed" ? "translated" : (s.target_text ? "needs-translation" : "new"),
          approved: s.status === "reviewed",
          source_tags: tags,
        };
      }),
    });
    return new NextResponse(xml, {
      headers: {
        "content-type": "application/x-xliff+xml; charset=utf-8",
        "content-disposition": `attachment; filename="${job.reference}.xlf"`,
      },
    });
  }

  if (fmt === "txt") {
    const lines = (segments ?? []).map((s) => s.target_text || s.source_text).join("\n");
    return new NextResponse(lines, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": `attachment; filename="${job.reference}.txt"`,
      },
    });
  }

  return new NextResponse("Unsupported format. Use ?format=xliff|txt", { status: 400 });
}
