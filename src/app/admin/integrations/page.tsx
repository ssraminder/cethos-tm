import { PageHeader, PlaceholderCard } from "@/components/AppShell";
export default function IntegrationsPage() {
  return (
    <>
      <PageHeader title="Integrations" subtitle="Vendor portal SSO, TMS job push API, MT engines, webhooks." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PlaceholderCard title="Vendor Portal SSO" body="Configure JWT issuer, JWKS URL, audience." />
        <PlaceholderCard title="TMS Job Push API" body="Generate API keys and webhook secrets." />
        <PlaceholderCard title="MT Engines" body="DeepL · Google · Custom endpoints." />
        <PlaceholderCard title="Outbound webhooks" body="job_complete · qa_threshold_exceeded · tm_updated." />
      </div>
    </>
  );
}
