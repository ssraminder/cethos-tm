import { PageHeader, KpiCard, PlaceholderCard } from "@/components/AppShell";

export default function PmDashboard() {
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Active jobs, translator workload, and alerts." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Active jobs" value="—" />
        <KpiCard label="Awaiting QA" value="—" />
        <KpiCard label="Overdue" value="—" />
        <KpiCard label="Avg leverage" value="—" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PlaceholderCard title="Job pipeline" />
        <PlaceholderCard title="QA issues by job" />
      </div>
    </>
  );
}
