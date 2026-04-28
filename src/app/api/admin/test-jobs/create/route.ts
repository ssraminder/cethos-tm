/**
 * POST /api/admin/test-jobs/create
 *
 * Vendor portal calls this when sending a translator-qualification test.
 * Creates everything needed for THIS specific test:
 *
 *   1. A TM job assigned to the vendor's pre-existing account (user_id).
 *   2. Auto-segmented source text (via createJobFromBuffer's existing pipeline).
 *   3. A single-use signin token (test_signin_tokens) for /t/<token>
 *      one-click landing into this specific job.
 *
 * The vendor account itself is provisioned separately by
 * /api/admin/vendor-accounts/upsert (called by the portal first). One
 * vendor account is reused across every test for that applicant — no more
 * disposable @cethos.test emails.
 *
 * Auth: Bearer API key with scope=test_provisioning.
 *
 * Idempotency: if a job already exists with external_ref =
 * test_submission:{test_submission_id}, return the existing job + a
 * fresh signin token. (Token freshness is intentional — the previous one
 * may have already been used; re-firing the V3 must yield a working link.)
 *
 * Errors are written to tm_errors so a stuck flow is debuggable.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiKey } from "@/lib/api-keys";
import { getServiceClient } from "@/lib/supabase/server";
import { createJobFromBuffer } from "@/lib/jobs/create";
import { audit } from "@/lib/auth/audit";
import { logTmError } from "@/lib/errors/tm-errors";

const InputSchema = z.object({
  test_submission_id: z.string().uuid(),
  user_id: z.string().uuid(),
  source_text: z.string().min(1).max(200_000),
  source_lang: z.string().min(2).max(10),
  target_lang: z.string().min(2).max(10),
  source_lang_name: z.string().min(1).max(120).optional(),
  target_lang_name: z.string().min(1).max(120).optional(),
  source_lang_rtl: z.boolean().optional(),
  target_lang_rtl: z.boolean().optional(),
  instructions: z.string().max(8000).optional(),
});

function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

export async function POST(req: NextRequest) {
  // ---- Auth ----
  const apiKey = bearer(req);
  if (!apiKey) {
    return NextResponse.json({ error: "Missing Bearer token" }, { status: 401 });
  }
  const record = await verifyApiKey(apiKey, "test_provisioning");
  if (!record) {
    return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 });
  }

  // ---- Validate input ----
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const p = parsed.data;

  if (p.source_lang === p.target_lang) {
    return NextResponse.json(
      { error: "source_lang and target_lang must differ" },
      { status: 422 },
    );
  }

  const supabase = await getServiceClient();

  // ---- Verify the vendor's profile exists ----
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", p.user_id)
    .maybeSingle();
  if (!profile) {
    await logTmError({
      route: "/api/admin/test-jobs/create",
      action: "profile_lookup",
      severity: "error",
      message: "user_id not found in profiles — call /api/admin/vendor-accounts/upsert first",
      context: { test_submission_id: p.test_submission_id, user_id: p.user_id },
    });
    return NextResponse.json(
      { error: "Vendor account not found. Provision it via /api/admin/vendor-accounts/upsert first." },
      { status: 422 },
    );
  }

  // ---- Idempotency: existing job for this submission_id? ----
  const externalRef = `test_submission:${p.test_submission_id}`;
  const { data: existingJob } = await supabase
    .from("jobs")
    .select("id, reference, segment_count, word_count")
    .eq("external_ref", externalRef)
    .maybeSingle();

  let jobInfo: {
    job_id: string;
    reference: string;
    segments: number;
    words: number;
  };

  if (existingJob) {
    const e = existingJob as {
      id: string;
      reference: string;
      segment_count: number;
      word_count: number;
    };
    jobInfo = {
      job_id: e.id,
      reference: e.reference,
      segments: e.segment_count,
      words: e.word_count,
    };
  } else {
    // ---- Auto-upsert languages so the job FK doesn't fail on new codes ----
    try {
      const langsToUpsert = [
        {
          code: p.source_lang,
          name: p.source_lang_name ?? p.source_lang,
          rtl: p.source_lang_rtl ?? false,
        },
        {
          code: p.target_lang,
          name: p.target_lang_name ?? p.target_lang,
          rtl: p.target_lang_rtl ?? false,
        },
      ];
      const { error: upsertErr } = await supabase
        .from("languages")
        .upsert(langsToUpsert, { onConflict: "code", ignoreDuplicates: true });
      if (upsertErr) throw new Error(upsertErr.message);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await logTmError({
        route: "/api/admin/test-jobs/create",
        action: "languages_upsert",
        severity: "error",
        message: msg,
        context: {
          test_submission_id: p.test_submission_id,
          source_lang: p.source_lang,
          target_lang: p.target_lang,
        },
      });
      return NextResponse.json(
        { error: `Could not upsert languages: ${msg}` },
        { status: 500 },
      );
    }

    // ---- Create the job (auto-segments via createJobFromBuffer) ----
    const sourceBuffer = Buffer.from(p.source_text, "utf8");
    const filename = `test-${p.test_submission_id}.txt`;
    let jobResult;
    try {
      jobResult = await createJobFromBuffer({
        source_buffer: sourceBuffer,
        source_filename: filename,
        source_mime_type: "text/plain",
        source_lang: p.source_lang,
        target_lang: p.target_lang,
        created_by: p.user_id,
        assigned_to: p.user_id,
        reviewer_id: null,
        client_id: record.client_id ?? null,
        external_ref: externalRef,
        source: "tms_push",
        reference: `TEST-${p.test_submission_id.slice(0, 8).toUpperCase()}`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await logTmError({
        route: "/api/admin/test-jobs/create",
        action: "create_job",
        severity: "error",
        message: msg,
        context: {
          test_submission_id: p.test_submission_id,
          user_id: p.user_id,
          source_lang: p.source_lang,
          target_lang: p.target_lang,
        },
      });
      return NextResponse.json(
        { error: `Could not create test job: ${msg}` },
        { status: 500 },
      );
    }
    jobInfo = {
      job_id: jobResult.job_id,
      reference: jobResult.reference,
      segments: jobResult.segments,
      words: jobResult.words,
    };
  }

  // ---- Mint a fresh single-use signin token for this test ----
  const tokenExpiresAt = new Date(
    Date.now() + 48 * 60 * 60 * 1000,
  ).toISOString();
  const { data: signinRow, error: signinErr } = await supabase
    .from("test_signin_tokens")
    .insert({
      user_id: p.user_id,
      job_id: jobInfo.job_id,
      expires_at: tokenExpiresAt,
    })
    .select("token")
    .single();

  if (signinErr || !signinRow) {
    await logTmError({
      route: "/api/admin/test-jobs/create",
      action: "signin_token_insert",
      severity: "error",
      message: signinErr?.message ?? "no token returned",
      context: {
        test_submission_id: p.test_submission_id,
        user_id: p.user_id,
        job_id: jobInfo.job_id,
      },
    });
    // Don't fail — caller can still email the editor URL + password as fallback.
  }

  const baseUrl = (process.env.APP_BASE_URL ?? "https://tm.cethos.com").replace(
    /\/$/,
    "",
  );
  const signinUrl = signinRow
    ? `${baseUrl}/t/${(signinRow as { token: string }).token}`
    : null;

  await audit({
    category: "job",
    action: existingJob ? "test_job_token_refreshed" : "test_job_provisioned",
    actorId: record.created_by,
    targetType: "job",
    targetId: jobInfo.job_id,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null,
    userAgent: req.headers.get("user-agent"),
    meta: {
      api_key_id: record.id,
      api_key_name: record.name,
      test_submission_id: p.test_submission_id,
      vendor_user_id: p.user_id,
      job_reference: jobInfo.reference,
      segments: jobInfo.segments,
      words: jobInfo.words,
    },
  });

  return NextResponse.json(
    {
      idempotent: !!existingJob,
      job_id: jobInfo.job_id,
      job_reference: jobInfo.reference,
      signin_url: signinUrl,
      segments: jobInfo.segments,
      words: jobInfo.words,
    },
    { status: existingJob ? 200 : 201 },
  );
}
