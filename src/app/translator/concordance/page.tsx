import { PageHeader } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { searchConcordance } from "@/lib/tm/concordance";

export const dynamic = "force-dynamic";

export default async function TranslatorConcordancePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  const query = (sp.q ?? "").trim();
  const results = query.length >= 2
    ? await searchConcordance({ query, user_id: me.id, role: me.role })
    : [];

  return (
    <>
      <PageHeader
        title="Concordance"
        subtitle="Search prior translations across TMs attached to your jobs."
      />

      <form method="get" className="rounded-lg bg-white border border-[color:var(--color-border)] p-4 mb-4 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Find phrase in TM…"
          className="flex-1 rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--color-teal)] focus:ring-[2px] focus:ring-[color:var(--color-teal)]/20"
          autoFocus
        />
        <button
          type="submit"
          className="px-4 py-2 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] text-white hover:bg-[color:var(--color-navy-700)]"
        >
          Search
        </button>
      </form>

      {query.length >= 2 ? (
        results.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[color:var(--color-border)] p-6 text-sm text-[color:var(--color-slate-500)] italic">
            No matches for &ldquo;{query}&rdquo; in your attached TMs.
          </div>
        ) : (
          <div className="rounded-lg bg-white border border-[color:var(--color-border)] divide-y divide-[color:var(--color-border-soft)]">
            {results.map((r) => (
              <div key={r.unit_id} className="p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[color:var(--color-slate-500)] mb-1.5">
                  <span className="font-bold text-[color:var(--color-navy)]">{r.tm_name}</span>
                  <span className="mono">
                    {r.source_lang} → {r.target_lang}
                  </span>
                  <span className="ml-auto">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <div className="mb-2">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-0.5">
                    Source &mdash; {r.source_lang}
                  </div>
                  <div className="text-sm mono text-[color:var(--color-slate-700)]">
                    {r.source_text}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-teal-700)] mb-0.5">
                    Target &mdash; {r.target_lang}
                  </div>
                  <div className="text-sm mono text-[color:var(--color-navy)]">
                    {r.target_text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="rounded-lg border border-dashed border-[color:var(--color-border)] p-6 text-sm text-[color:var(--color-slate-500)] italic">
          Type at least 2 characters and press Search to find prior
          translations across the TMs attached to your assigned jobs.
        </div>
      )}
    </>
  );
}
