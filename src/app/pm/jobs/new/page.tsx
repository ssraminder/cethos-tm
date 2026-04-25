import { PageHeader } from "@/components/AppShell";
import { getServiceClient } from "@/lib/supabase/server";
import { createJobFromUploadAction } from "./actions";

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const supabase = await getServiceClient();
  const [{ data: languages }, { data: translators }] = await Promise.all([
    supabase.from("languages").select("code,name").eq("enabled", true).order("name"),
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .in("role", ["translator", "reviewer"])
      .eq("status", "active")
      .order("full_name"),
  ]);

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
            <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Source file</label>
            <input
              type="file"
              name="file"
              required
              accept=".txt,.md,.html,.htm,.docx,.json,.xliff,.xlf,text/plain,text/html,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/json"
              className="block w-full text-sm rounded-md border border-[color:var(--color-slate-200)] file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-[color:var(--color-navy)] file:text-white file:text-xs file:font-semibold hover:file:bg-[color:var(--color-navy-700)]"
            />
            <p className="text-xs text-[color:var(--color-slate-500)] mt-1">Supported: .txt, .md, .html, .docx, .json. Max 50 MB. XLIFF coming soon.</p>
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
              {translators?.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name || t.email} ({t.role})</option>
              ))}
            </select>
            <p className="text-xs text-[color:var(--color-slate-500)] mt-1">If you skip this, the job is saved as a draft. Assign from the job page when ready.</p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button type="submit" className="px-4 py-2.5 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] hover:bg-[color:var(--color-navy-700)] text-white transition">
            Create job & segment
          </button>
          <a href="/pm/jobs" className="px-4 py-2.5 text-sm font-semibold rounded-md border border-[color:var(--color-slate-200)] bg-white hover:bg-[color:var(--color-slate-50)]">Cancel</a>
        </div>
      </form>
    </>
  );
}
