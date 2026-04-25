import { PageHeader, PlaceholderCard } from "@/components/AppShell";
import { getServiceClient } from "@/lib/supabase/server";

export default async function AuditPage() {
  const supabase = await getServiceClient();
  const { data: events } = await supabase
    .from("audit_log")
    .select("id, created_at, actor_email, category, action, target_type, target_id, ip_address")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every meaningful action — auth, user, TM, termbase, jobs, settings." />
      {!events || events.length === 0 ? (
        <PlaceholderCard title="No events yet" body="Sign in once to populate the first record." />
      ) : (
        <div className="bg-white rounded-xl border border-[color:var(--color-border)] overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-[color:var(--color-slate-50)] text-[color:var(--color-slate-500)] uppercase tracking-wide">
              <tr><th className="text-left px-3 py-2 font-bold">Time</th><th className="text-left px-3 py-2 font-bold">Actor</th><th className="text-left px-3 py-2 font-bold">Category</th><th className="text-left px-3 py-2 font-bold">Action</th><th className="text-left px-3 py-2 font-bold">Target</th><th className="text-left px-3 py-2 font-bold">IP</th></tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-[color:var(--color-border-soft)]">
                  <td className="px-3 py-2 mono whitespace-nowrap">{new Date(e.created_at).toISOString().slice(0, 19).replace("T", " ")}</td>
                  <td className="px-3 py-2">{e.actor_email ?? "—"}</td>
                  <td className="px-3 py-2 capitalize">{e.category}</td>
                  <td className="px-3 py-2 mono">{e.action}</td>
                  <td className="px-3 py-2">{e.target_type ? `${e.target_type}:${e.target_id ?? ""}` : "—"}</td>
                  <td className="px-3 py-2 mono">{e.ip_address ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
