import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { runDeliver } from "@/lib/qa/deliver";

export async function POST(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const me = await getCurrentUser();
  const { jobId } = await ctx.params;

  const result = await runDeliver(jobId, me.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
