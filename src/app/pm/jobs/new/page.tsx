import { PageHeader, PlaceholderCard } from "@/components/AppShell";
export default function NewJobPage() {
  return (
    <>
      <PageHeader title="Create job" subtitle="Upload source, choose language pair, attach TM/TB, assign a translator." />
      <PlaceholderCard title="Job creation wizard coming next" body="The DB schema and APIs are in place; UI is the next iteration." />
    </>
  );
}
