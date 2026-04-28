/**
 * POST /api/admin/test-jobs/create
 *
 * Vendor portal calls this when sending a translator-qualification test.
 * Creates everything the applicant needs to take the test in one shot:
 *
 *   1. A disposable Supabase Auth user (random email + 16+ char password)
 *   2. A profile row (role=translator)
 *   3. A TM job assigned to that user
 *   4. Auto-segmented source text (via createJobFromBuffer's existing pipeline)
 *
 * The portal includes the returned credentials + job URL in the V3 invitation
 * email so the applicant can log in and start translating segment-by-segment.
 *
 * Auth: Bearer API key with scope=test_provisioning. Portal owns one such key.
 *
 * Idempotency: if a row in test_provisioning_records already exists for the
 * given test_submission_id, returns the existing credentials/job. Re-running
 * the same call does not create a second account.
 *
 * Errors are also written to tm_errors so a stuck flow is debuggable.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { verifyApiKey } from "@/lib/api-keys";
import { getServiceClient } from "@/lib/supabase/server";
import { createJobFromBuffer } from "@/lib/jobs/create";
import { audit } from "@/lib/auth/audit";
import { logTmError } from "@/lib/errors/tm-errors";

const InputSchema = z.object({
  test_submission_id: z.string().uuid(),
  applicant_full_name: z.string().min(1).max(200),
  source_text: z.string().min(1).max(200_000),
  source_lang: z.string().min(2).max(10),
  target_lang: z.string().min(2).max(10),
  instructions: z.string().max(8000).optional(),
});

function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

/**
 * Generate a disposable applicant email + a strong random password.
 * Email lives at @cethos.test (RFC 6761 reserved TLD — safe for disposable
 * accounts, won't accidentally route real mail).
 */
function generateCredentials(): { email: string; password: string } {
  const id = randomBytes(6).toString("hex"); // 12-char hex
  const email = `test-${id}@cethos.test`;
  // 24 hex chars + a fixed mixed-class suffix to satisfy any UI hint about
  // letter / number / symbol mixing. Total length 28.
  const password = `${randomBytes(12).toString("hex")}Aa1!`;
  return { email, password };
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

  // ---- Idempotency: same submission_id → return prior credentials/job ----
  // The portal sometimes retries (e.g. transient timeout); we don't want to
  // mint a second account in that case.
  const { data: prior } = await supabase
    .from("test_provisioning_records")
    .select("id, applicant_email, applicant_password, job_id, job_reference")
    .eq("test_submission_id", p.test_submission_id)
    .maybeSingle();

  if (prior) {
    return NextResponse.json(
      {
        idempotent: true,
        applicant_email: (prior as { applicant_email: string }).applicant_email,
        applicant_password: (prior as { applicant_password: string })
          .applicant_password,
        job_id: (prior as { job_id: string }).job_id,
        job_reference: (prior as { job_reference: string }).job_reference,
      },
      { status: 200 },
    );
  }

  // ---- 1. Mint disposable account ----
  const { email, password } = generateCredentials();

  let userId: string;
  try {
    const { data: created, error: createErr } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // skip email verification — disposable account
        user_metadata: {
          full_name: p.applicant_full_name,
          role: "translator",
          test_account: true,
        },
        app_metadata: {
          role: "translator",
          auth_source: "test_provisioning",
        },
      });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "auth.admin.createUser returned no user");
    }
    userId = created.user.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logTmError({
      route: "/api/admin/test-jobs/create",
      action: "auth_create_user",
      severity: "error",
      message: msg,
      context: {
        test_submission_id: p.test_submission_id,
        applicant_email: email,
        api_key_id: record.id,
      },
    });
    return NextResponse.json(
      { error: `Could not create test account: ${msg}` },
      { status: 500 },
    );
  }

  // ---- 2. Profile row ----
  try {
    const { error: profileErr } = await supabase.from("profiles").insert({
      id: userId,
      email,
      full_name: p.applicant_full_name,
      role: "translator",
      status: "active",
      auth_source: "test_provisioning",
      mfa_required: false, // applicants don't go through MFA on the test flow
      meta: {
        test_account: true,
        test_submission_id: p.test_submission_id,
        provisioned_at: new Date().toISOString(),
      },
    });
    if (profileErr) throw new Error(profileErr.message);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logTmError({
      route: "/api/admin/test-jobs/create",
      action: "profile_insert",
      severity: "error",
      message: msg,
      context: {
        test_submission_id: p.test_submission_id,
        user_id: userId,
      },
    });
    // Best-effort cleanup on failure: delete the auth user so we don't leak
    // accounts.
    try {
      await supabase.auth.admin.deleteUser(userId);
    } catch { /* best-effort */ }
    return NextResponse.json(
      { error: `Could not create profile: ${msg}` },
      { status: 500 },
    );
  }

  // ---- 3. Create the job (auto-segments via createJobFromBuffer) ----
  // We hand the source as a plain-text buffer with a .txt filename. The
  // existing extractor handles .txt → UTF-8 read → SBD sentence split.
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
      // Use the applicant's own profile id as creator — they "own" the job.
      // This avoids audit-log oddness where a portal API key shows as creator.
      created_by: userId,
      assigned_to: userId,
      reviewer_id: null,
      client_id: record.client_id ?? null,
      external_ref: `test_submission:${p.test_submission_id}`,
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
        user_id: userId,
        source_lang: p.source_lang,
        target_lang: p.target_lang,
      },
    });
    // Cleanup to avoid orphan accounts. Best-effort — these failures are
    // already in a degraded state, so swallow secondary errors.
    try {
      await supabase.from("profiles").delete().eq("id", userId);
    } catch { /* best-effort */ }
    try {
      await supabase.auth.admin.deleteUser(userId);
    } catch { /* best-effort */ }
    return NextResponse.json(
      { error: `Could not create test job: ${msg}` },
      { status: 500 },
    );
  }

  // ---- 4. Persist the provisioning record (idempotency anchor + audit) ----
  // Stored AS-IS so the portal can include the password in the V3 email. The
  // password is also returned in the response. These accounts are disposable
  // and tied to a 48 h test-submission TTL, so storing the plaintext password
  // is acceptable in this scope. (Rotate by deleting the row + auth user.)
  await supabase.from("test_provisioning_records").insert({
    test_submission_id: p.test_submission_id,
    user_id: userId,
    applicant_email: email,
    applicant_password: password,
    job_id: jobResult.job_id,
    job_reference: jobResult.reference,
    api_key_id: record.id,
  });

  await audit({
    category: "job",
    action: "test_job_provisioned",
    actorId: record.created_by,
    targetType: "job",
    targetId: jobResult.job_id,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null,
    userAgent: req.headers.get("user-agent"),
    meta: {
      api_key_id: record.id,
      api_key_name: record.name,
      test_submission_id: p.test_submission_id,
      applicant_email: email,
      job_reference: jobResult.reference,
      segments: jobResult.segments,
      words: jobResult.words,
    },
  });

  return NextResponse.json(
    {
      idempotent: false,
      applicant_email: email,
      applicant_password: password,
      job_id: jobResult.job_id,
      job_reference: jobResult.reference,
      segments: jobResult.segments,
      words: jobResult.words,
    },
    { status: 201 },
  );
}
