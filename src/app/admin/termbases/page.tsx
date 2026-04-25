import Link from "next/link";
import { PageHeader, PlaceholderCard } from "@/components/AppShell";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";

export default async function TermbasesPage() {
  await requireRole(["admin"]);
  const supabase = await getServiceClient();
  const { data: tbs } = await supabase
    .from("termbases")
    .select("id, name, languages, scope, description, created_at")
    .order("created_at", { ascending: false });

  const ids = (tbs ?? []).map((t) => t.id);
  let counts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: rows } = await supabase
      .from("term_concepts")
      .select("termbase_id, term_entries(count)")
      .in("termbase_id", ids);
    counts = (rows ?? []).reduce<Record<string, number>>((acc, r) => {
      acc[r.termbase_id] = (acc[r.termbase_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  return (
    <>
      <PageHeader
        title="Termbases"
        subtitle="Concept-based terminology with approved, pending, and forbidden terms."
        actions={<Link href="/admin/termbases/new" className="px-3 py-2 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] text-white">Create termbase</Link>}
      />
      {!tbs || tbs.length === 0 ? (
        <PlaceholderCard title="No termbases yet" body="Create one and import a TBX file." />
      ) : (
        <div className="bg-white rounded-xl border border-[color:var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--color-slate-50)] text-[color:var(--color-slate-500)] text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2 font-bold">Name</th>
                <th className="text-left px-4 py-2 font-bold">Languages</th>
                <th className="text-left px-4 py-2 font-bold">Scope</th>
                <th className="text-left px-4 py-2 font-bold">Concepts</th>
                <th className="text-left px-4 py-2 font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {tbs.map((t) => (
                <tr key={t.id} className="border-t border-[color:var(--color-border-soft)] hover:bg-[color:var(--color-slate-50)]">
                  <td className="px-4 py-2">
                    <div className="font-semibold text-[color:var(--color-navy)]">{t.name}</div>
                    {t.description && <div className="text-xs text-[color:var(--color-slate-500)] mt-0.5">{t.description}</div>}
                  </td>
                  <td className="px-4 py-2 mono text-xs">{(t.languages ?? []).join(", ") || "—"}</td>
                  <td className="px-4 py-2 capitalize">{t.scope}</td>
                  <td className="px-4 py-2 mono">{counts[t.id] ?? 0}</td>
                  <td className="px-4 py-2"><Link href={`/admin/termbases/${t.id}`} className="text-[color:var(--color-teal-700)] font-semibold">Open →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
