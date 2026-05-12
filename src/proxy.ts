import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { jwtVerify } from "jose";
import { env } from "@/lib/env";
import { MFA_COOKIE_NAME } from "@/lib/auth/mfa-cookie";
import { SESSION_COOKIE_NAME as CETHOS_SESSION_COOKIE } from "@/lib/cethos-auth/schema";

const PUBLIC_PATHS = [
  "/sign-in",
  "/verify",
  "/invite",
  "/forgot-password",
  "/reset-password",
  "/sso",
  "/t",                   // /t/[token] — vendor-portal magic-link entry, validates token from internal DB before any session is established
  "/api",                 // /api/* uses Bearer-token auth (or none for public health), never the Supabase session
  "/_next",
  "/favicon.ico",
  "/assets",
];

const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  pm: "/pm",
  translator: "/translator",
  reviewer: "/translator",
};

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return res;

  // ────────────────────────────────────────────────────────────────────
  // Path A — cethos-auth session cookie. New, China-friendly path used
  // by translators arriving via vendor-portal SSO. Just presence-check
  // here; deeper validation (revoked/expired) happens server-side in
  // getCurrentUser. The middleware's job is to spare obviously-logged-
  // out users from loading the SPA shell.
  //
  // Cethos sessions skip the MFA gate by construction: SSO at the
  // issuing portal already validated MFA upstream, and the direct
  // sign-in flow that lands in cethos sessions issues them only after
  // OTP completes (Phase B follow-up). No second factor needed here.
  // ────────────────────────────────────────────────────────────────────
  if (req.cookies.get(CETHOS_SESSION_COOKIE)?.value) {
    if (pathname === "/" || pathname === "/home") {
      // Generic landing → role home requires reading the user, which
      // the middleware can't do without a DB call. Cheap fallback:
      // send to /translator (most common role). Server-side
      // current-user will redirect again if needed.
      const url = req.nextUrl.clone();
      url.pathname = "/translator";
      return NextResponse.redirect(url);
    }
    return res;
  }

  // ────────────────────────────────────────────────────────────────────
  // Path B — legacy Supabase Auth + MFA cookie.
  // ────────────────────────────────────────────────────────────────────
  const cookieMethods: CookieMethodsServer = {
    getAll: () => req.cookies.getAll(),
    setAll: (toSet) => {
      for (const { name, value, options } of toSet) res.cookies.set({ name, value, ...options });
    },
  };
  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: cookieMethods,
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // MFA gate: signed in but OTP not yet passed.
  const mfaToken = req.cookies.get(MFA_COOKIE_NAME)?.value;
  let mfaOk = false;
  if (mfaToken) {
    try {
      await jwtVerify(mfaToken, new TextEncoder().encode(env.appSecret));
      mfaOk = true;
    } catch { mfaOk = false; }
  }
  if (!mfaOk) {
    const url = req.nextUrl.clone();
    url.pathname = "/verify";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Role-routing: redirect generic / paths to the user's home.
  if (pathname === "/" || pathname === "/home") {
    const role = (user.app_metadata?.role as string) || (user.user_metadata?.role as string);
    const home = ROLE_HOME[role] ?? "/translator";
    const url = req.nextUrl.clone();
    url.pathname = home;
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets/).*)"],
};
