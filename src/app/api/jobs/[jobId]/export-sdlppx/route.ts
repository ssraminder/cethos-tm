import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getServiceClient } from "@/lib/supabase/server";
import { exportJobAsSdlPackage } from "@/lib/jobs/sdlxliff-export";

export async function GET(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const me = await getCurrentUser();
  const { jobId } = await ctx.params;
  const type = req.nextUrl.searchParams.get("type") === "sdlppx" ? "sdlppx" : "sdlrpx";

  const supabase = await getServiceClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("assigned_to, reviewer_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const isStaff = me.role === "admin" || me.role === "pm";
  if (!isStaff && job.assigned_to !== me.id && job.reviewer_id !== me.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await exportJobAsSdlPackage(jobId, type);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
