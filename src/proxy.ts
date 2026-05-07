import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/cethos-auth/schema";

// Cookie-presence check only. Full DB validation happens in server components
// via getCurrentUser() → getSessionUser(). Keeping middleware lightweight
// avoids cold-start latency on every edge request.
const PUBLIC_PATHS = [
  "/sign-in",
  "/verify",
  "/invite",
  "/sso",
  "/t",
  "/api",
  "/_next",
  "/favicon.ico",
  "/assets",
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const sessionId = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets/).*)"],
};
