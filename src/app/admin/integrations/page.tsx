import Link from "next/link";
import { PageHeader, PlaceholderCard } from "@/components/AppShell";
export default function IntegrationsPage() {
  return (
    <>
      <PageHeader title="Integrations" subtitle="Vendor portal SSO, TMS job push API, MT engines, webhooks." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PlaceholderCard title="Vendor Portal SSO" body="Configure JWT issuer, JWKS URL, audience." />
        <Link href="/admin/integrations/api-keys" className="bg-white rounded-xl border border-[color:var(--color-border)] p-8 text-center hover:bg-[color:var(--color-slate-50)] block">
          <div className="font-semibold text-[color:var(--color-navy)]">TMS Job Push API</div>
          <div className="text-sm text-[color:var(--color-slate-500)] mt-1">Mint and revoke API keys for inbound job ingest.</div>
          <div className="text-xs text-[color:var(--color-teal-700)] font-semibold mt-2">Manage keys →</div>
        </Link>
        <PlaceholderCard title="MT Engines" body="DeepL · Google · Custom — set via env vars for now." />
        <PlaceholderCard title="Outbound webhooks" body="job_complete · qa_threshold_exceeded · tm_updated." />
      </div>
    </>
  );
}
