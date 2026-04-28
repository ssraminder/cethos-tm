/**
 * POST /api/admin/vendor-accounts/upsert
 *
 * Idempotently provisions a TM-Cethos vendor account for an applicant from
 * the vendor portal. Replaces the previous "disposable test-<hex>@cethos.test
 * account per test" model — vendors now have ONE persistent TM account keyed
 * by their real email, reused across every test, every domain, every
 * subsequent invitation.
 *
 * Auth: Bearer API key with scope=test_provisioning (same key the portal
 * uses for /api/admin/test-jobs/create).
 *
 * Request:
 *   { applicant_email, applicant_full_name }
 *
 * Behaviour:
 *   - If a profile already exists for this email → return its id + email.
 *     `applicant_password` is omitted (caller already has it from a prior
 *     call; if they don't, the vendor changes it from /profile).
 *   - If no profile yet → mint a fresh auth user with a random 16+char
 *     password, insert profile (role=translator, mfa_required=false so the
 *     V3-emailed password works without an OTP gate), return everything
 *     the caller needs to email the vendor.
 *
 * Response:
 *   {
 *     idempotent: boolean,         // true if profile already existed
 *     user_id: string,
 *     applicant_email: string,
 *     applicant_password?: string  // only present when idempotent=false
 *   }
 *
 * Failures: write to tm_errors and clean up partial state (delete auth user
 * if profile insert fails) so we never leak orphan accounts.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { verifyApiKey } from "@/lib/api-keys";
import { getServiceClient } from "@/lib/supabase/server";
import { logTmError } from "@/lib/errors/tm-errors";

const InputSchema = z.object({
  applicant_email: z.string().email().toLowerCase(),
  applicant_full_name: z.string().min(1).max(200),
});

function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

/**
 * 16+ char password mixing hex + a fixed mixed-class suffix.
 * The vendor receives this in their V3 invitation and can change it from
 * /profile in TM. Mixed classes satisfy any UI password-strength hint.
 */
function generatePassword(): string {
  return `${randomBytes(8).toString("hex")}Aa1!`;
}

export async function POST(req: NextRequest) {
  // Auth
  const apiKey = bearer(req);
  if (!apiKey) {
    return NextResponse.json({ error: "Missing Bearer token" }, { status: 401 });
  }
  const record = await verifyApiKey(apiKey, "test_provisioning");
  if (!record) {
    return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 });
  }

  // Parse body
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
  const { applicant_email, applicant_full_name } = parsed.data;

  const supabase = await getServiceClient();

  // 1. If profile exists already, return it. Idempotent.
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, email")
    .ilike("email", applicant_email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        idempotent: true,
        user_id: (existing as { id: string }).id,
        applicant_email: (existing as { email: string }).email,
      },
      { status: 200 },
    );
  }

  // 2. Mint a fresh auth user.
  const password = generatePassword();
  let userId: string;
  try {
    const { data: created, error: createErr } =
      await supabase.auth.admin.createUser({
        email: applicant_email,
        password,
        email_confirm: true, // skip the Supabase-side email verification
        user_metadata: { full_name: applicant_full_name, role: "translator" },
        app_metadata: {
          role: "translator",
          auth_source: "vendor_portal_sso",
        },
      });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "auth.admin.createUser returned no user");
    }
    userId = created.user.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logTmError({
      route: "/api/admin/vendor-accounts/upsert",
      action: "auth_create_user",
      severity: "error",
      message: msg,
      context: { applicant_email, api_key_id: record.id },
    });
    return NextResponse.json(
      { error: `Could not create vendor account: ${msg}` },
      { status: 500 },
    );
  }

  // 3. Insert profile. mfa_required=false so the password we email works
  //    without an OTP gate (the @cethos.test test accounts had this same
  //    setup; real vendor emails could optionally re-enable MFA later).
  try {
    const { error: profileErr } = await supabase.from("profiles").insert({
      id: userId,
      email: applicant_email,
      full_name: applicant_full_name,
      role: "translator",
      status: "active",
      auth_source: "vendor_portal_sso",
      mfa_required: false,
      meta: {
        vendor_account: true,
        provisioned_at: new Date().toISOString(),
        provisioned_by_api_key_id: record.id,
      },
    });
    if (profileErr) throw new Error(profileErr.message);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logTmError({
      route: "/api/admin/vendor-accounts/upsert",
      action: "profile_insert",
      severity: "error",
      message: msg,
      context: { applicant_email, user_id: userId },
    });
    // Cleanup orphan auth user.
    try {
      await supabase.auth.admin.deleteUser(userId);
    } catch { /* best-effort */ }
    return NextResponse.json(
      { error: `Could not create profile: ${msg}` },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      idempotent: false,
      user_id: userId,
      applicant_email,
      applicant_password: password,
    },
    { status: 201 },
  );
}
