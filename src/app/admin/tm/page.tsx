import { PageHeader, PlaceholderCard } from "@/components/AppShell";

export default function AdminTmPage() {
  return (
    <>
      <PageHeader
        title="Translation Memories"
        subtitle="Create, import (TMX), and maintain TMs scoped to client, project, or globally."
        actions={
          <>
            <button className="px-3 py-2 text-sm font-semibold rounded-md border border-[color:var(--color-slate-200)] bg-white">Import TMX</button>
            <button className="px-3 py-2 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] text-white">Create TM</button>
          </>
        }
      />
      <PlaceholderCard title="No translation memories yet" body="Click 'Create TM' or 'Import TMX' to get started." />
    </>
  );
}
