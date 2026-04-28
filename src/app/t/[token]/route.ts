/**
 * GET /t/[token]
 *
 * One-shot magic-link entry point for vendor-portal test applicants.
 *
 * Flow:
 *   1. Look up `test_signin_tokens` by token.
 *   2. Reject if missing / expired / already used.
 *   3. Mark token used (atomic — even if the rest fails, the token is dead).
 *   4. Resolve the bound profile + email.
 *   5. Issue Supabase magic link via `auth.admin.generateLink({type: "magiclink"})`.
 *   6. Set the MFA-skipped cookie (so the proxy middleware doesn't bounce
 *      to /verify on the post-callback redirect).
 *   7. 302-redirect to the Supabase action_link, which signs the user in
 *      and bounces them to redirectTo (the editor for their job).
 *
 * Tokens live in our own DB (test_signin_tokens), not Supabase Auth — so we
 * don't depend on the applicant being able to receive emails at the
 * test-<hex>@cethos.test address.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { issueMfaCookie } from "@/lib/auth/mfa-cookie";
import { logTmError } from "@/lib/errors/tm-errors";
import { env } from "@/lib/env";

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!token || !uuidRe.test(token)) {
    return errorRedirect(req, "Invalid sign-in link.");
  }

  const supabase = await getServiceClient();

  // 1. Look up the token row.
  const { data: tokenRow } = await supabase
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
      "This sign-in link has already been used. Please contact support.",
    );
  }
  if (new Date(t.expires_at).getTime() < Date.now()) {
    return errorRedirect(req, "This sign-in link has expired.");
  }

  // 2. Mark used immediately so a refresh / replay can't double-use it.
  const { error: markErr } = await supabase
    .from("test_signin_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token)
    .is("used_at", null);
  if (markErr) {
    await logTmError({
      route: "/t/[token]",
      action: "token_mark_used",
      severity: "error",
      message: markErr.message,
      context: { token, user_id: t.user_id },
    });
    return errorRedirect(req, "Could not redeem sign-in link.");
  }

  // 3. Resolve profile email.
  const { data: profile } = await supabase
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

  // 4. Generate a fresh Supabase magic link for that user. We use Supabase's
  //    own auth callback (not the email it would send) — admin.generateLink
  //    returns the link without sending email when called with the admin key.
  const redirectAfter = t.job_id
    ? `${env.appBaseUrl}/translator/editor/${t.job_id}`
    : `${env.appBaseUrl}/translator`;

  const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: p.email,
    options: { redirectTo: redirectAfter },
  });

  if (linkErr || !link?.properties?.action_link) {
    await logTmError({
      route: "/t/[token]",
      action: "generate_magiclink",
      severity: "error",
      message: linkErr?.message ?? "no action_link returned",
      context: { token, user_id: t.user_id, email: p.email },
    });
    return errorRedirect(req, "Could not create sign-in link.");
  }

  // 5. Pre-set the MFA-skipped cookie so the proxy middleware lets the user
  //    through to /translator/editor/<jobId> after Supabase's callback. The
  //    cookie is HTTP-only and signed with APP_SECRET — the next request
  //    (post-callback) will send it back with the session cookie.
  await issueMfaCookie(p.id, p.email);

  // 6. 302-redirect to Supabase's action_link, which completes the auth
  //    handshake and bounces to redirectAfter.
  return NextResponse.redirect(link.properties.action_link);
}
