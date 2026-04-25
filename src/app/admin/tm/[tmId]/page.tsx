import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, KpiCard } from "@/components/AppShell";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import { importTmxAction } from "../actions";

export default async function TmDetail({
  params,
  searchParams,
}: {
  params: Promise<{ tmId: string }>;
  searchParams: Promise<{ q?: string; imported?: string; skipped?: string; error?: string }>;
}) {
  await requireRole(["admin"]);
  const { tmId } = await params;
  const sp = await searchParams;

  const supabase = await getServiceClient();
  const { data: tm } = await supabase
    .from("translation_memories")
    .select("*")
    .eq("id", tmId)
    .maybeSingle();
  if (!tm) notFound();

  const { count: unitCount } = await supabase.from("tm_units").select("*", { count: "exact", head: true }).eq("tm_id", tmId);

  let unitsQ = supabase
    .from("tm_units")
    .select("id, source_text, target_text, quality_score, forbidden, created_at")
    .eq("tm_id", tmId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (sp.q && sp.q.trim()) {
    const term = sp.q.trim();
    unitsQ = unitsQ.or(`source_text.ilike.%${term}%,target_text.ilike.%${term}%`);
  }
  const { data: units } = await unitsQ;

  const { data: imports } = await supabase
    .from("tm_imports")
    .select("id, filename, status, units_total, units_added, units_skipped, error, created_at, completed_at")
    .eq("tm_id", tmId)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <>
      <PageHeader
        title={tm.name}
        subtitle={`${tm.source_lang} → ${tm.target_lang} · ${tm.scope}${tm.description ? ` · ${tm.description}` : ""}`}
      />

      {sp.imported && (
        <div className="mb-4 rounded-md border border-[color:var(--color-emerald-100)] bg-[color:var(--color-emerald-50)] text-[color:var(--color-emerald-700)] px-3 py-2 text-sm">
          Imported {sp.imported} units{sp.skipped && Number(sp.skipped) > 0 ? `, skipped ${sp.skipped} duplicates` : ""}.
        </div>
      )}
      {sp.error && (
        <div className="mb-4 rounded-md border border-[color:var(--color-rose-100)] bg-[color:var(--color-rose-50)] text-[color:var(--color-rose-600)] px-3 py-2 text-sm">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Units" value={(unitCount ?? 0).toLocaleString()} />
        <KpiCard label="Pair" value={`${tm.source_lang} → ${tm.target_lang}`} />
        <KpiCard label="Scope" value={tm.scope} />
        <KpiCard label="Created" value={new Date(tm.created_at).toLocaleDateString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)]">Units</div>
            <form className="flex gap-2">
              <input type="text" name="q" defaultValue={sp.q ?? ""} placeholder="Search source or target…"
                className="rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-1.5 text-xs w-72" />
              <button type="submit" className="px-2 py-1.5 text-xs font-semibold rounded-md border border-[color:var(--color-slate-200)] bg-white">Search</button>
            </form>
          </div>
          <div className="bg-white rounded-xl border border-[color:var(--color-border)] overflow-hidden">
            {(units ?? []).length === 0 ? (
              <div className="p-8 text-center text-sm text-[color:var(--color-slate-500)]">
                {sp.q ? "No units match your search." : "No units yet — import a TMX to populate this TM."}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[color:var(--color-slate-50)] text-[color:var(--color-slate-500)] text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2 font-bold w-1/2">Source</th>
                    <th className="text-left px-4 py-2 font-bold w-1/2">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {units!.map((u) => (
                    <tr key={u.id} className="border-t border-[color:var(--color-border-soft)] align-top">
                      <td className="px-4 py-2 mono">{u.source_text}</td>
                      <td className="px-4 py-2 mono">{u.target_text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="bg-white rounded-xl border border-[color:var(--color-border)] p-4">
            <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-2">Import TMX</div>
            <form action={importTmxAction} encType="multipart/form-data" className="space-y-2">
              <input type="hidden" name="tm_id" value={tm.id} />
              <input type="file" name="file" required accept=".tmx,application/xml,text/xml"
                className="block w-full text-xs file:mr-2 file:py-1.5 file:px-2 file:rounded-md file:border-0 file:bg-[color:var(--color-navy)] file:text-white file:text-xs file:font-semibold" />
              <button type="submit" className="w-full px-3 py-1.5 text-xs font-semibold rounded-md bg-[color:var(--color-teal-700)] hover:bg-[color:var(--color-teal)] text-white">
                Import units
              </button>
            </form>
            <p className="text-[10px] text-[color:var(--color-slate-500)] mt-2">TMX 1.4. Up to 100 MB.</p>
          </div>

          <div className="bg-white rounded-xl border border-[color:var(--color-border)] p-4">
            <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-2">Recent imports</div>
            {(imports ?? []).length === 0 ? (
              <div className="text-xs text-[color:var(--color-slate-500)]">None yet.</div>
            ) : (
              <ul className="space-y-2">
                {imports!.map((imp) => (
                  <li key={imp.id} className="text-xs border-b border-[color:var(--color-border-soft)] last:border-0 pb-2 last:pb-0">
                    <div className="mono font-semibold text-[color:var(--color-navy)] truncate">{imp.filename}</div>
                    <div className="text-[color:var(--color-slate-500)]">
                      {imp.status === "completed" && <>{imp.units_added}/{imp.units_total} added · {imp.units_skipped} dup</>}
                      {imp.status === "failed" && <span className="text-[color:var(--color-rose-600)]">Failed: {imp.error}</span>}
                      {imp.status === "processing" && <>Processing…</>}
                      <span className="ml-2">{new Date(imp.created_at).toLocaleString()}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-xl border border-[color:var(--color-border)] p-4">
            <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-2">Use this TM</div>
            <p className="text-xs text-[color:var(--color-slate-500)] mb-2">Attach this TM to a job from the job's detail page → Resources panel.</p>
            <Link href="/pm/jobs" className="text-xs font-semibold text-[color:var(--color-teal-700)] hover:underline">View jobs →</Link>
          </div>
        </aside>
      </div>
    </>
  );
}
