import { PageHeader, KpiCard, PlaceholderCard } from "@/components/AppShell";

export default function AdminDashboard() {
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Translation memory, terminology, and QA at a glance." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Active jobs" value="—" hint="No jobs ingested yet" />
        <KpiCard label="TM units" value="—" hint="Import a TMX to start" />
        <KpiCard label="Termbase entries" value="—" />
        <KpiCard label="Avg TM leverage" value="—" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <PlaceholderCard title="Leverage trend" body="Charts appear once jobs run through the editor." />
        <PlaceholderCard title="QA issues by severity" body="Surfaces critical/major/minor counts." />
      </div>
      <PlaceholderCard title="Recent activity" body="Audit log will populate this stream." />
    </>
  );
}
