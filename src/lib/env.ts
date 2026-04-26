// NEXT_PUBLIC_* vars must be referenced as direct property access
// (process.env.NAME) so Next.js can inline them into the client bundle at
// build time. Dynamic access (process.env[name]) does NOT get inlined and
// will be undefined in the browser.

function req(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function opt(value: string | undefined, fallback = ""): string {
  return value ?? fallback;
}

export const env = {
  // Public (browser-safe) — direct property access for Next.js inlining
  supabaseUrl: req("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: req("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),

  // Server-only
  supabaseServiceRoleKey: opt(process.env.SUPABASE_SERVICE_ROLE_KEY),
  appSecret: opt(process.env.APP_SECRET, "dev-only-change-me"),
  appBaseUrl: opt(process.env.APP_BASE_URL, "http://localhost:3000"),
  mailgun: {
    apiKey: opt(process.env.MAILGUN_API_KEY),
    region: opt(process.env.MAILGUN_REGION, "us") as "us" | "eu",
    domain: opt(process.env.MAILGUN_DOMAIN),
    fromEmail: opt(process.env.MAILGUN_FROM_EMAIL, "Cethos CAT <noreply@cethos.local>"),
  },
  vendorPortal: {
    issuer: opt(process.env.VENDOR_PORTAL_JWT_ISSUER),
    audience: opt(process.env.VENDOR_PORTAL_JWT_AUDIENCE, "cethos-cat"),
    jwksUrl: opt(process.env.VENDOR_PORTAL_JWKS_URL),
  },
  // Shared admin/vendor-portal Supabase backend — read-only source for
  // clients and vendors. Service role key required for admin-only tables.
  portal: {
    url: opt(process.env.PORTAL_SUPABASE_URL),
    serviceRoleKey: opt(process.env.PORTAL_SUPABASE_SERVICE_ROLE_KEY),
  },
};
