import Link from "next/link";
import { PageHeader, PlaceholderCard } from "@/components/AppShell";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";

export default async function AdminTmPage() {
  await requireRole(["admin"]);
  const supabase = await getServiceClient();
  const { data: tms } = await supabase
    .from("translation_memories")
    .select("id, name, source_lang, target_lang, scope, created_at, description")
    .order("created_at", { ascending: false });

  // Per-TM unit counts
  const ids = (tms ?? []).map((t) => t.id);
  let counts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: rows } = await supabase
      .from("tm_units")
      .select("tm_id", { count: "exact" })
      .in("tm_id", ids);
    counts = (rows ?? []).reduce<Record<string, number>>((acc, r) => {
      acc[r.tm_id] = (acc[r.tm_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  return (
    <>
      <PageHeader
        title="Translation Memories"
        subtitle="Create, import (TMX), and maintain TMs scoped to client, project, or globally."
        actions={<Link href="/admin/tm/new" className="px-3 py-2 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] text-white">Create TM</Link>}
      />
      {!tms || tms.length === 0 ? (
        <PlaceholderCard title="No translation memories yet" body="Click 'Create TM' to start, then import a TMX." />
      ) : (
        <div className="bg-white rounded-xl border border-[color:var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--color-slate-50)] text-[color:var(--color-slate-500)] text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2 font-bold">Name</th>
                <th className="text-left px-4 py-2 font-bold">Pair</th>
                <th className="text-left px-4 py-2 font-bold">Scope</th>
                <th className="text-left px-4 py-2 font-bold">Units</th>
                <th className="text-left px-4 py-2 font-bold">Created</th>
                <th className="text-left px-4 py-2 font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {tms.map((t) => (
                <tr key={t.id} className="border-t border-[color:var(--color-border-soft)] hover:bg-[color:var(--color-slate-50)]">
                  <td className="px-4 py-2">
                    <div className="font-semibold text-[color:var(--color-navy)]">{t.name}</div>
                    {t.description && <div className="text-xs text-[color:var(--color-slate-500)] mt-0.5">{t.description}</div>}
                  </td>
                  <td className="px-4 py-2 mono">{t.source_lang} → {t.target_lang}</td>
                  <td className="px-4 py-2 capitalize">{t.scope}</td>
                  <td className="px-4 py-2 mono">{(counts[t.id] ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-2 text-xs text-[color:var(--color-slate-500)]">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2">
                    <Link href={`/admin/tm/${t.id}`} className="text-[color:var(--color-teal-700)] font-semibold">Open →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
