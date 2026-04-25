import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";
import { env } from "../env";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!env.vendorPortal.jwksUrl) throw new Error("VENDOR_PORTAL_JWKS_URL not set");
  if (!jwks) jwks = createRemoteJWKSet(new URL(env.vendorPortal.jwksUrl));
  return jwks;
}

export interface VendorPortalClaims extends JWTPayload {
  vendor_user_id: string;
  email: string;
  full_name?: string;
  role?: "translator" | "reviewer";
  job_external_ref?: string;
}

export async function verifyVendorJwt(token: string): Promise<VendorPortalClaims> {
  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: env.vendorPortal.issuer || undefined,
    audience: env.vendorPortal.audience || undefined,
  });
  if (!payload.email || !payload.vendor_user_id) {
    throw new Error("SSO token missing required claims");
  }
  return payload as VendorPortalClaims;
}
