import { PageHeader, PlaceholderCard } from "@/components/AppShell";
export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Organization, branding, security, email, API keys, data retention." />
      <PlaceholderCard title="Settings UI coming next" body="Mailgun + SSO configuration are wired in environment variables for now." />
    </>
  );
}
