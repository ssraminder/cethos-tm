import { PageHeader } from "@/components/AppShell";
import { getServiceClient } from "@/lib/supabase/server";

export default async function LanguagesPage() {
  const supabase = await getServiceClient();
  const { data: langs } = await supabase.from("languages").select("*").order("name");
  return (
    <>
      <PageHeader title="Languages & locales" subtitle="Enabled BCP-47 codes for source/target selection." />
      <div className="bg-white rounded-xl border border-[color:var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--color-slate-50)] text-[color:var(--color-slate-500)] text-xs uppercase tracking-wide">
            <tr><th className="text-left px-4 py-2 font-bold">Code</th><th className="text-left px-4 py-2 font-bold">Name</th><th className="text-left px-4 py-2 font-bold">Native</th><th className="text-left px-4 py-2 font-bold">RTL</th><th className="text-left px-4 py-2 font-bold">Enabled</th></tr>
          </thead>
          <tbody>
            {langs?.map((l) => (
              <tr key={l.code} className="border-t border-[color:var(--color-border-soft)]">
                <td className="px-4 py-2 mono">{l.code}</td>
                <td className="px-4 py-2">{l.name}</td>
                <td className="px-4 py-2 text-[color:var(--color-slate-500)]">{l.native_name}</td>
                <td className="px-4 py-2">{l.rtl ? "Yes" : "—"}</td>
                <td className="px-4 py-2">{l.enabled ? "Yes" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
