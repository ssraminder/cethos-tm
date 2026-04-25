import { PageHeader } from "@/components/AppShell";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import { createTmAction } from "../actions";

export default async function NewTmPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const supabase = await getServiceClient();
  const [{ data: languages }, { data: clients }] = await Promise.all([
    supabase.from("languages").select("code, name").eq("enabled", true).order("name"),
    supabase.from("clients").select("id, name").eq("active", true).order("name"),
  ]);

  return (
    <>
      <PageHeader title="Create translation memory" subtitle="A bucket of source/target unit pairs scoped to a client, project, or globally." />
      {sp.error && (
        <div className="mb-4 rounded-md border border-[color:var(--color-rose-100)] bg-[color:var(--color-rose-50)] text-[color:var(--color-rose-600)] px-3 py-2 text-sm">
          {decodeURIComponent(sp.error)}
        </div>
      )}
      <form action={createTmAction} className="bg-white rounded-xl border border-[color:var(--color-border)] p-6 max-w-2xl space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Name</label>
          <input type="text" name="name" required maxLength={120}
            className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm"
            placeholder="e.g. Acme Brand EN→FR Master" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Description</label>
          <textarea name="description" maxLength={500} rows={2}
            className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Source language</label>
            <select name="source_lang" required defaultValue="en-US"
              className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm">
              {languages?.map((l) => <option key={l.code} value={l.code}>{l.name} ({l.code})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Target language</label>
            <select name="target_lang" required defaultValue="fr-FR"
              className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm">
              {languages?.map((l) => <option key={l.code} value={l.code}>{l.name} ({l.code})</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Scope</label>
            <select name="scope" defaultValue="client"
              className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm">
              <option value="global">Global</option>
              <option value="client">Client</option>
              <option value="project">Project</option>
              <option value="job">Job</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Client (optional)</label>
            <select name="client_id" defaultValue=""
              className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm">
              <option value="">— None —</option>
              {clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="px-4 py-2.5 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] hover:bg-[color:var(--color-navy-700)] text-white">Create TM</button>
          <a href="/admin/tm" className="px-4 py-2.5 text-sm font-semibold rounded-md border border-[color:var(--color-slate-200)] bg-white">Cancel</a>
        </div>
      </form>
    </>
  );
}
