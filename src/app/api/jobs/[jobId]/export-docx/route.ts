import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getServiceClient } from "@/lib/supabase/server";
import { exportJobAsDocx } from "@/lib/jobs/docx-export";

export async function GET(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const me = await getCurrentUser();
  const { jobId } = await ctx.params;

  // Auth: assignee, reviewer, or staff.
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

  const result = await exportJobAsDocx(jobId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
