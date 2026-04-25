import { PageHeader, PlaceholderCard } from "@/components/AppShell";

export default function TermbasesPage() {
  return (
    <>
      <PageHeader title="Termbases" subtitle="Concept-based terminology with approved, pending, and forbidden terms." actions={
        <button className="px-3 py-2 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] text-white">Create termbase</button>
      }/>
      <PlaceholderCard title="No termbases yet" />
    </>
  );
}
