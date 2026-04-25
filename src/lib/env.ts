function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  supabaseServiceRoleKey: optional("SUPABASE_SERVICE_ROLE_KEY"),
  appSecret: optional("APP_SECRET", "dev-only-change-me"),
  appBaseUrl: optional("APP_BASE_URL", "http://localhost:3000"),
  mailgun: {
    apiKey: optional("MAILGUN_API_KEY"),
    region: optional("MAILGUN_REGION", "us") as "us" | "eu",
    domain: optional("MAILGUN_DOMAIN"),
    fromEmail: optional("MAILGUN_FROM_EMAIL", "Cethos CAT <noreply@cethos.local>"),
  },
  vendorPortal: {
    issuer: optional("VENDOR_PORTAL_JWT_ISSUER"),
    audience: optional("VENDOR_PORTAL_JWT_AUDIENCE", "cethos-cat"),
    jwksUrl: optional("VENDOR_PORTAL_JWKS_URL"),
  },
};
