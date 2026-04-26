import { PageHeader } from "@/components/AppShell";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import { createJobFromUploadAction } from "./actions";

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; project?: string }>;
}) {
  const me = await requireRole(["admin", "pm"]);
  const sp = await searchParams;
  const supabase = await getServiceClient();

  // Resolve which projects the user can attach to.
  // Admin → all projects. PM → projects they can_manage_project on.
  let projects: Array<{ id: string; name: string; reference: string | null; status: string }> = [];
  if (me.role === "admin") {
    const { data } = await supabase
      .from("projects")
      .select("id, name, reference, status")
      .in("status", ["draft", "active", "on_hold"])
      .order("created_at", { ascending: false });
    projects = data ?? [];
  } else {
    const [{ data: explicit }, { data: defaultAll }] = await Promise.all([
      supabase
        .from("project_pms")
        .select("projects!inner(id, name, reference, status)")
        .eq("pm_id", me.id),
      supabase
        .from("projects")
        .select("id, name, reference, status, project_pms(pm_id)")
        .in("status", ["draft", "active", "on_hold"])
        .order("created_at", { ascending: false }),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const explicitItems = (explicit ?? []).map((r) => (r as any).projects).filter(Boolean);
    const explicitIds = new Set(explicitItems.map((p) => p.id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const defaultItems = (defaultAll ?? []).filter((p: any) => (p.project_pms?.length ?? 0) === 0 && !explicitIds.has(p.id))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => ({ id: p.id, name: p.name, reference: p.reference, status: p.status }));
    projects = [...explicitItems, ...defaultItems];
  }

  // If a project is preselected, narrow the vendor list to its pool (when set).
  const preProjectId = sp.project ?? "";
  let vendorPool: Array<{ id: string; full_name: string | null; email: string; role: string }> | null = null;
  if (preProjectId) {
    const { data: pv } = await supabase
      .from("project_vendors")
      .select("profiles!inner(id, email, full_name, role)")
      .eq("project_id", preProjectId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (pv ?? []).map((r) => (r as any).profiles).filter(Boolean);
    if (items.length > 0) vendorPool = items;
  }

  // Otherwise show all active translators/reviewers.
  const { data: allTranslators } = vendorPool
    ? { data: vendorPool }
    : await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .in("role", ["translator", "reviewer"])
        .eq("status", "active")
        .order("full_name");

  const { data: languages } = await supabase.from("languages").select("code,name").eq("enabled", true).order("name");

  return (
    <>
      <PageHeader
        title="Create job"
        subtitle="Upload a source file. We'll extract text, segment it, and open it in the editor."
      />

      {sp.error && (
        <div className="mb-4 rounded-md border border-[color:var(--color-rose-100)] bg-[color:var(--color-rose-50)] text-[color:var(--color-rose-600)] px-3 py-2 text-sm">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <form action={createJobFromUploadAction} encType="multipart/form-data" className="bg-white rounded-xl border border-[color:var(--color-border)] p-6 max-w-3xl">
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Project (optional)</label>
            <select name="project_id" defaultValue={preProjectId}
              className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm">
              <option value="">— No project (standalone job) —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.reference ? ` (${p.reference})` : ""} · {p.status.replace("_", " ")}</option>
              ))}
            </select>
            {preProjectId && vendorPool && (
              <p className="text-xs text-[color:var(--color-slate-500)] mt-1">
                Project has a vendor pool — only its {vendorPool.length} translator{vendorPool.length === 1 ? "" : "s"} are listed below.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Source file</label>
            <input
              type="file"
              name="file"
              required
              accept=".txt,.md,.html,.htm,.docx,.json,.xliff,.xlf,text/plain,text/html,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/json"
              className="block w-full text-sm rounded-md border border-[color:var(--color-slate-200)] file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-[color:var(--color-navy)] file:text-white file:text-xs file:font-semibold hover:file:bg-[color:var(--color-navy-700)]"
            />
            <p className="text-xs text-[color:var(--color-slate-500)] mt-1">Supported: .txt, .md, .html, .docx, .json, .xliff/.xlf. Max 50 MB.</p>
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
              <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Reference (optional)</label>
              <input type="text" name="reference" placeholder="auto-generated if blank"
                className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm mono"/>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Deadline (optional)</label>
              <input type="datetime-local" name="deadline"
                className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm"/>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Assign to translator</label>
            <select name="assigned_to" defaultValue=""
              className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm">
              <option value="">— Leave as draft, assign later —</option>
              {(allTranslators ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.full_name || t.email} ({t.role})</option>
              ))}
            </select>
            <p className="text-xs text-[color:var(--color-slate-500)] mt-1">
              {vendorPool
                ? "Showing only the vendor pool for the selected project."
                : "Skipping leaves the job as a draft. Assign from the job page when ready."}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button type="submit" className="px-4 py-2.5 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] hover:bg-[color:var(--color-navy-700)] text-white transition">
            Create job &amp; segment
          </button>
          <a href={preProjectId ? `/admin/projects/${preProjectId}` : "/pm/jobs"} className="px-4 py-2.5 text-sm font-semibold rounded-md border border-[color:var(--color-slate-200)] bg-white hover:bg-[color:var(--color-slate-50)]">Cancel</a>
        </div>
      </form>
    </>
  );
}
