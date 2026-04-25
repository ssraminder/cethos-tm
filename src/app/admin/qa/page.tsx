import { PageHeader, PlaceholderCard } from "@/components/AppShell";
export default function QaPage() {
  return (
    <>
      <PageHeader title="QA Profiles" subtitle="Configurable rule sets — tag mismatch, terminology, length ratio, custom regex." />
      <PlaceholderCard title="No QA profiles yet" body="A default profile will be seeded once we add the first migration data." />
    </>
  );
}
