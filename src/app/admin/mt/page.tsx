import { PageHeader, PlaceholderCard } from "@/components/AppShell";
export default function MtPage() {
  return (
    <>
      <PageHeader title="Machine translation engines" subtitle="DeepL, Google Cloud Translation, and custom endpoints." />
      <PlaceholderCard title="No engines configured" body="Add API keys in Settings > Integrations." />
    </>
  );
}
