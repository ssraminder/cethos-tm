/**
 * GET /t/[token]
 *
 * One-shot magic-link entry point for vendor-portal test applicants.
 *
 * The applicant cannot receive emails at test-<hex>@cethos.test, so the
 * normal password+OTP path is unusable. Instead, the vendor-portal links
 * the V3 invitation directly here. We:
 *
 *   1. Validate the internal-DB token (test_signin_tokens). One-shot,
 *      time-bounded, replay-safe.
 *   2. Mint a Supabase OTP via admin.generateLink({type:"magiclink"}) to
 *      get a `hashed_token` we can verify server-side without sending
 *      any email.
 *   3. Call the SSR Supabase client's `verifyOtp` with that hash — this
 *      issues a session and persists it on the response cookies.
 *   4. Set the MFA-skipped JWT cookie on the same response so the proxy
 *      middleware lets the user through to /translator/editor/<jobId>.
 *   5. Mark the internal token used and 302-redirect to the editor.
 *
 * Everything happens server-side on tm.cethos.com — no cross-domain hops
 * through Supabase Auth's verify endpoint. Cookies set on this response
 * are sent back with the redirect, so the editor request lands signed in.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { SignJWT } from "jose";
import { getServiceClient } from "@/lib/supabase/server";
import { logTmError } from "@/lib/errors/tm-errors";
import { env } from "@/lib/env";

const MFA_COOKIE_NAME = "cethos_mfa";
const MFA_TTL_HOURS = 12;

interface TokenRow {
  token: string;
  user_id: string;
  job_id: string | null;
  expires_at: string;
  used_at: string | null;
}

interface ProfileRow {
  id: string;
  email: string;
}

function errorRedirect(req: NextRequest, message: string): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "";
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

async function signMfaJwt(userId: string, email: string): Promise<string> {
  const key = new TextEncoder().encode(env.appSecret);
  return await new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MFA_TTL_HOURS}h`)
    .sign(key);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!token || !uuidRe.test(token)) {
    return errorRedirect(req, "Invalid sign-in link.");
  }

  const adminClient = await getServiceClient();

  // 1. Look up + validate the internal token row.
  const { data: tokenRow } = await adminClient
    .from("test_signin_tokens")
    .select("token, user_id, job_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (!tokenRow) {
    return errorRedirect(req, "Sign-in link not found or expired.");
  }
  const t = tokenRow as TokenRow;
  if (t.used_at) {
    return errorRedirect(
      req,
      "This sign-in link has already been used. Please contact support for a new one.",
    );
  }
  if (new Date(t.expires_at).getTime() < Date.now()) {
    return errorRedirect(req, "This sign-in link has expired.");
  }

  // 2. Look up the bound profile (need email for verifyOtp).
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, email")
    .eq("id", t.user_id)
    .maybeSingle();
  if (!profile) {
    await logTmError({
      route: "/t/[token]",
      action: "profile_lookup",
      severity: "error",
      message: "profile not found for token user_id",
      context: { token, user_id: t.user_id },
    });
    return errorRedirect(req, "Account not provisioned.");
  }
  const p = profile as ProfileRow;

  // 3. Mint a magic-link OTP. We discard the email Supabase would send;
  //    we only want the hashed_token to verify server-side.
  const redirectAfter = t.job_id
    ? `${env.appBaseUrl}/translator/editor/${t.job_id}`
    : `${env.appBaseUrl}/translator`;

  const { data: link, error: linkErr } =
    await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: p.email,
      options: { redirectTo: redirectAfter },
    });
  const hashedToken = link?.properties?.hashed_token;
  if (linkErr || !hashedToken) {
    await logTmError({
      route: "/t/[token]",
      action: "generate_magiclink",
      severity: "error",
      message: linkErr?.message ?? "no hashed_token returned",
      context: { token, user_id: t.user_id, email: p.email },
    });
    return errorRedirect(req, "Could not create sign-in link.");
  }

  // 4. Build the redirect response up-front so the SSR client + the MFA
  //    cookie can both write to it. We don't redirect until verification
  //    has succeeded; on any failure we replace the response with an
  //    error redirect.
  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = t.job_id
    ? `/translator/editor/${t.job_id}`
    : `/translator`;
  redirectUrl.search = "";
  const res = NextResponse.redirect(redirectUrl);

  const cookieMethods: CookieMethodsServer = {
    getAll: () => req.cookies.getAll(),
    setAll: (toSet) => {
      for (const c of toSet) {
        res.cookies.set({ name: c.name, value: c.value, ...c.options });
      }
    },
  };
  const ssrClient = createServerClient(
    env.supabaseUrl,
    env.supabasePublishableKey,
    { cookies: cookieMethods },
  );

  // 5. Verify the OTP server-side. On success, the SSR client writes the
  //    session cookies to `res` via cookieMethods.setAll above.
  const { error: verifyErr } = await ssrClient.auth.verifyOtp({
    type: "magiclink",
    token_hash: hashedToken,
    email: p.email,
  });
  if (verifyErr) {
    await logTmError({
      route: "/t/[token]",
      action: "verify_otp",
      severity: "error",
      message: verifyErr.message,
      context: { token, user_id: t.user_id, email: p.email },
    });
    return errorRedirect(req, "Could not complete sign-in.");
  }

  // 6. Mark the internal token used (after successful verify so a failed
  //    verify can be retried within the TTL).
  await adminClient
    .from("test_signin_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token)
    .is("used_at", null);

  // 7. Set the MFA-skipped cookie ON THE REDIRECT RESPONSE so the proxy
  //    middleware doesn't bounce the editor request to /verify. The cookie
  //    is HTTP-only, signed with APP_SECRET — same shape that
  //    issueMfaCookie() uses for the password+OTP path.
  const mfaJwt = await signMfaJwt(p.id, p.email);
  res.cookies.set({
    name: MFA_COOKIE_NAME,
    value: mfaJwt,
    httpOnly: true,
    secure: env.appBaseUrl.startsWith("https"),
    sameSite: "lax",
    path: "/",
    maxAge: MFA_TTL_HOURS * 3600,
  });

  return res;
}
