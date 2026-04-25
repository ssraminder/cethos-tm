import { PageHeader, PlaceholderCard } from "@/components/AppShell";
export default function ConcordancePage() {
  return (
    <>
      <PageHeader title="Concordance" subtitle="Search across all translation memories." />
      <PlaceholderCard title="Concordance search" body="Type a phrase to find prior translations once TMs are populated." />
    </>
  );
}
