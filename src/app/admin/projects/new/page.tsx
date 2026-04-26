import { PageHeader } from "@/components/AppShell";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import { createProjectAction } from "../actions";

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const supabase = await getServiceClient();
  const { data: clients } = await supabase.from("clients").select("id, name").eq("active", true).order("name");

  return (
    <>
      <PageHeader title="Create project" subtitle="Set up a project, then assign PMs and vendors from the detail page." />
      {sp.error && (
        <div className="mb-4 rounded-md border border-[color:var(--color-rose-100)] bg-[color:var(--color-rose-50)] text-[color:var(--color-rose-600)] px-3 py-2 text-sm">
          {decodeURIComponent(sp.error)}
        </div>
      )}
      <form action={createProjectAction} className="bg-white rounded-xl border border-[color:var(--color-border)] p-6 max-w-2xl space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Name</label>
          <input type="text" name="name" required maxLength={160}
            placeholder="e.g. Acme Q2 Marketing Localization"
            className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Reference (optional)</label>
            <input type="text" name="reference" maxLength={64}
              placeholder="ACME-Q2-MKT"
              className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm mono" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Status</label>
            <select name="status" defaultValue="draft" className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm">
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="on_hold">On hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Client (optional)</label>
            <select name="client_id" defaultValue="" className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm">
              <option value="">— None —</option>
              {clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Deadline (optional)</label>
            <input type="datetime-local" name="deadline"
              className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Description</label>
          <textarea name="description" maxLength={2000} rows={3}
            placeholder="What's the scope, audience, brand voice? Anything PMs need to know."
            className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm" />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="px-4 py-2.5 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] hover:bg-[color:var(--color-navy-700)] text-white">Create project</button>
          <a href="/admin/projects" className="px-4 py-2.5 text-sm font-semibold rounded-md border border-[color:var(--color-slate-200)] bg-white">Cancel</a>
        </div>
        <p className="text-xs text-[color:var(--color-slate-500)]">PMs and vendors are assigned on the project detail page after creation. Leaving PMs empty makes the project visible to all PMs.</p>
      </form>
    </>
  );
}
