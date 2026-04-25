import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../env";

const COOKIE_NAME = "cethos_mfa";
const TTL_HOURS = 12;

function key() {
  return new TextEncoder().encode(env.appSecret);
}

export async function issueMfaCookie(userId: string, email: string): Promise<void> {
  const token = await new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_HOURS}h`)
    .sign(key());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.appBaseUrl.startsWith("https"),
    sameSite: "lax",
    path: "/",
    maxAge: TTL_HOURS * 3600,
  });
}

export async function readMfaCookie(): Promise<{ sub: string; email: string } | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return { sub: String(payload.sub), email: String(payload.email) };
  } catch {
    return null;
  }
}

export async function clearMfaCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function readMfaCookieFromRequest(req: Request): Promise<boolean> {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.split(/;\s*/).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return false;
  try {
    const token = match.split("=", 2)[1];
    await jwtVerify(token, key());
    return true;
  } catch {
    return false;
  }
}

export const MFA_COOKIE_NAME = COOKIE_NAME;
