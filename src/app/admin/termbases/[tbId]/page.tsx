import { notFound } from "next/navigation";
import { PageHeader, KpiCard } from "@/components/AppShell";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import { importTbxAction } from "../actions";

export default async function TermbaseDetail({
  params,
  searchParams,
}: {
  params: Promise<{ tbId: string }>;
  searchParams: Promise<{ q?: string; imported?: string; concepts?: string; error?: string }>;
}) {
  await requireRole(["admin"]);
  const { tbId } = await params;
  const sp = await searchParams;

  const supabase = await getServiceClient();
  const { data: tb } = await supabase.from("termbases").select("*").eq("id", tbId).maybeSingle();
  if (!tb) notFound();

  const { count: conceptCount } = await supabase
    .from("term_concepts")
    .select("*", { count: "exact", head: true })
    .eq("termbase_id", tbId);

  // Load concepts + their entries
  let conceptIds: string[] = [];
  let entries: Array<{ id: string; concept_id: string; language: string; term: string; status: string; part_of_speech: string | null }> = [];
  {
    let cq = supabase
      .from("term_concepts")
      .select("id, domain, definition")
      .eq("termbase_id", tbId)
      .limit(50);
    const { data: concepts } = await cq;
    conceptIds = (concepts ?? []).map((c) => c.id);
    if (conceptIds.length > 0) {
      let eq = supabase
        .from("term_entries")
        .select("id, concept_id, language, term, status, part_of_speech")
        .in("concept_id", conceptIds);
      if (sp.q) eq = eq.ilike("term", `%${sp.q}%`);
      const { data: ents } = await eq;
      entries = ents ?? [];
    }
  }

  // Group entries by concept
  const grouped = new Map<string, typeof entries>();
  for (const e of entries) {
    const arr = grouped.get(e.concept_id) ?? [];
    arr.push(e);
    grouped.set(e.concept_id, arr);
  }

  return (
    <>
      <PageHeader
        title={tb.name}
        subtitle={`${(tb.languages ?? []).join(", ")} · ${tb.scope}${tb.description ? ` · ${tb.description}` : ""}`}
      />

      {sp.imported && (
        <div className="mb-4 rounded-md border border-[color:var(--color-emerald-100)] bg-[color:var(--color-emerald-50)] text-[color:var(--color-emerald-700)] px-3 py-2 text-sm">
          Imported {sp.concepts} concepts / {sp.imported} term entries.
        </div>
      )}
      {sp.error && (
        <div className="mb-4 rounded-md border border-[color:var(--color-rose-100)] bg-[color:var(--color-rose-50)] text-[color:var(--color-rose-600)] px-3 py-2 text-sm">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Concepts" value={(conceptCount ?? 0).toLocaleString()} />
        <KpiCard label="Languages" value={(tb.languages ?? []).length.toString()} />
        <KpiCard label="Scope" value={tb.scope} />
        <KpiCard label="Created" value={new Date(tb.created_at).toLocaleDateString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)]">Concepts (first 50)</div>
            <form className="flex gap-2">
              <input type="text" name="q" defaultValue={sp.q ?? ""} placeholder="Search term…"
                className="rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-1.5 text-xs w-72" />
              <button type="submit" className="px-2 py-1.5 text-xs font-semibold rounded-md border border-[color:var(--color-slate-200)] bg-white">Search</button>
            </form>
          </div>
          {grouped.size === 0 ? (
            <div className="bg-white rounded-xl border border-[color:var(--color-border)] p-8 text-center text-sm text-[color:var(--color-slate-500)]">
              {sp.q ? "No terms match your search." : "No concepts yet — import a TBX file."}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[color:var(--color-border)] divide-y divide-[color:var(--color-border-soft)]">
              {Array.from(grouped.entries()).slice(0, 50).map(([cid, ents]) => (
                <div key={cid} className="p-3">
                  <div className="text-[10px] uppercase tracking-wide font-bold text-[color:var(--color-slate-500)] mono mb-1.5">
                    Concept {cid.slice(0, 8)}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {ents.map((e) => (
                      <div key={e.id} className="rounded border border-[color:var(--color-border)] p-2 text-sm">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold uppercase mono text-[color:var(--color-slate-500)]">{e.language}</span>
                          {e.status === "approved" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--color-emerald-100)] text-[color:var(--color-emerald-700)] font-bold">approved</span>}
                          {e.status === "pending" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--color-amber-100)] text-[color:var(--color-amber-600)] font-bold">pending</span>}
                          {e.status === "forbidden" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--color-rose-100)] text-[color:var(--color-rose-600)] font-bold">forbidden</span>}
                        </div>
                        <div className={["mono", e.status === "forbidden" ? "line-through text-[color:var(--color-rose-600)]" : "text-[color:var(--color-navy)]"].join(" ")}>{e.term}</div>
                        {e.part_of_speech && <div className="text-[10px] text-[color:var(--color-slate-500)]">{e.part_of_speech}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="bg-white rounded-xl border border-[color:var(--color-border)] p-4">
            <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-2">Import TBX</div>
            <form action={importTbxAction} encType="multipart/form-data" className="space-y-2">
              <input type="hidden" name="tb_id" value={tb.id} />
              <input type="file" name="file" required accept=".tbx,.xml,application/xml,text/xml"
                className="block w-full text-xs file:mr-2 file:py-1.5 file:px-2 file:rounded-md file:border-0 file:bg-[color:var(--color-navy)] file:text-white file:text-xs file:font-semibold" />
              <button type="submit" className="w-full px-3 py-1.5 text-xs font-semibold rounded-md bg-[color:var(--color-teal-700)] hover:bg-[color:var(--color-teal)] text-white">Import</button>
            </form>
            <p className="text-[10px] text-[color:var(--color-slate-500)] mt-2">TBX 2.0 / TBX-Basic / TBX 3.0 supported.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
