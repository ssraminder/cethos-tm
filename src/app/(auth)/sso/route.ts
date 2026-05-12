/**
 * Vendor → TM SSO consumer.
 *
 * Flow: vendor portal mints a 5-minute ES256 JWT (see `sso-issue.ts`
 * in `cethos-vendor`), redirects the browser to
 * `https://tm.cethos.com/sso?token=<jwt>&job=<external_ref?>`. This
 * handler:
 *
 *   1. Verifies the JWT against vendor portal's published JWKS.
 *   2. Find-or-creates the user in `cethos_users` (auth source-of-truth)
 *      and mirrors into `profiles` so existing app code that joins to
 *      `profiles` keeps working during the cethos-auth migration.
 *   3. Creates a cethos_sessions row, sets `cethos_session_tm` cookie
 *      on `.cethos.com`. No Supabase Auth, no magic-link round-trip,
 *      no second-factor — SSO at the issuing portal already handled
 *      MFA upstream.
 *   4. Lands the translator on `/translator/editor?ref=<job>` if the
 *      vendor passed a job_external_ref, otherwise `/translator`.
 *
 * China-friendly: the browser only ever talks to `tm.cethos.com`. The
 * JWKS fetch + Postgres write happen server-side from Vercel iad1,
 * which is unfiltered traffic FROM China's perspective.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyVendorJwt } from "@/lib/auth/sso";
import { getServiceClient } from "@/lib/supabase/server";
import { upsertOnSignIn } from "@/lib/cethos-auth/users";
import { createSession, buildSessionCookie } from "@/lib/cethos-auth/sessions";
import { audit } from "@/lib/auth/audit";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const jobRef = req.nextUrl.searchParams.get("job");

  if (!token) {
    return NextResponse.redirect(new URL("/sign-in?error=Missing+SSO+token", req.url));
  }

  let claims;
  try {
    claims = await verifyVendorJwt(token);
  } catch (e) {
    console.error("[sso] verification failed", e);
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent("Invalid or expired SSO token.")}`, req.url),
    );
  }

  const email = claims.email.toLowerCase();
  const role = (claims.role === "reviewer" ? "reviewer" : "translator") as "translator" | "reviewer";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const ua = req.headers.get("user-agent") ?? null;

  try {
    // 1) Upsert into cethos_users (auth source-of-truth).
    const cethosUser = await upsertOnSignIn({
      email,
      full_name: claims.full_name ?? null,
      default_role: role,
      legacy_vendor_session_id: claims.vendor_user_id,
    });

    // 2) Mirror into `profiles` so existing app code (which still
    //    joins to profiles for role / status checks during the
    //    transition) sees this user. Not the source-of-truth — the
    //    cethos_users row is. Best-effort upsert by email; failures
    //    are logged but don't block sign-in.
    try {
      const supabase = await getServiceClient();
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, status")
        .eq("email", email)
        .maybeSingle();

      if (!existingProfile) {
        await supabase.from("profiles").insert({
          id: cethosUser.id,
          email,
          full_name: claims.full_name ?? null,
          role,
          status: "active",
          auth_source: "vendor_portal_sso",
          vendor_user_id: claims.vendor_user_id,
          mfa_required: false,
        });
      } else if ((existingProfile as { status?: string }).status !== "active") {
        return NextResponse.redirect(new URL("/sign-in?error=Account+inactive", req.url));
      }
    } catch (e) {
      console.warn("[sso] profiles mirror skipped:", e instanceof Error ? e.message : String(e));
    }

    // 3) Issue cethos session + set cookie.
    const session = await createSession({
      user_id: cethosUser.id,
      ip_address: ip,
      user_agent: ua,
    });
    const cookieAttrs = buildSessionCookie(session.id);

    const dest = jobRef
      ? `/translator/editor?ref=${encodeURIComponent(jobRef)}`
      : role === "reviewer"
        ? "/translator"  // reviewers share the translator inbox today
        : "/translator";

    const redirectUrl = new URL(dest, req.url);
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.set({
      name: cookieAttrs.name,
      value: cookieAttrs.value,
      httpOnly: cookieAttrs.httpOnly,
      secure: cookieAttrs.secure,
      sameSite: cookieAttrs.sameSite,
      path: cookieAttrs.path,
      domain: cookieAttrs.domain,
      maxAge: cookieAttrs.maxAge,
    });

    await audit({
      category: "auth",
      action: "sso_signin",
      actorId: cethosUser.id,
      actorEmail: email,
      ip,
      userAgent: ua,
      meta: {
        vendor_user_id: claims.vendor_user_id,
        job_ref: jobRef,
        backend: "cethos-auth",
      },
    });

    return res;
  } catch (e) {
    console.error("[sso] session provisioning failed", e);
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent("Failed to start your session.")}`, req.url),
    );
  }
}
