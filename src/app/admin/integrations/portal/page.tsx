import { PageHeader, KpiCard } from "@/components/AppShell";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import { isPortalConfigured } from "@/lib/portal/client";
import { syncPortalAction } from "./actions";

export default async function PortalSyncPage({
  searchParams,
}: {
  searchParams: Promise<{ ca?: string; cu?: string; va?: string; vu?: string; err?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const supabase = await getServiceClient();

  const [
    { count: clientsTotal },
    { count: clientsSynced },
    { count: vendorsTotal },
    { count: vendorsSynced },
    { data: lastRun },
    { data: recentRuns },
  ] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }).eq("active", true),
    supabase.from("clients").select("*", { count: "exact", head: true }).not("portal_synced_at", "is", null),
    supabase.from("profiles").select("*", { count: "exact", head: true }).in("role", ["translator", "reviewer"]),
    supabase.from("profiles").select("*", { count: "exact", head: true })
      .in("role", ["translator", "reviewer"])
      .not("portal_synced_at", "is", null),
    supabase.from("portal_sync_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("portal_sync_runs").select("id, kind, status, clients_added, clients_updated, vendors_added, vendors_updated, error, started_at, finished_at, profiles(email)").order("started_at", { ascending: false }).limit(15),
  ]);

  const configured = isPortalConfigured();
  const ranThisRequest = sp.ca || sp.cu || sp.va || sp.vu;

  return (
    <>
      <PageHeader
        title="Portal sync"
        subtitle="Pull customers and vendors from the shared admin / vendor-portal Supabase into the CAT tool."
      />

      {!configured && (
        <div className="mb-4 rounded-md border border-[color:var(--color-amber-100)] bg-[color:var(--color-amber-50)] text-[color:var(--color-amber-600)] px-3 py-2 text-sm">
          <span className="font-bold">Portal not configured.</span> Set <code className="mono text-xs">PORTAL_SUPABASE_URL</code> and <code className="mono text-xs">PORTAL_SUPABASE_SERVICE_ROLE_KEY</code> in your environment, then redeploy. Until then sync runs are inert.
        </div>
      )}

      {ranThisRequest && (
        <div className="mb-4 rounded-md border border-[color:var(--color-emerald-100)] bg-[color:var(--color-emerald-50)] text-[color:var(--color-emerald-700)] px-3 py-2 text-sm">
          Sync complete — clients: {sp.ca} added, {sp.cu} updated · vendors: {sp.va} added, {sp.vu} updated.
          {sp.err && <div className="mt-1 text-[color:var(--color-rose-600)]">Errors: {decodeURIComponent(sp.err)}</div>}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Clients (total)" value={String(clientsTotal ?? 0)} />
        <KpiCard label="Clients (synced)" value={String(clientsSynced ?? 0)} hint={`from portal`} />
        <KpiCard label="Vendors (total)" value={String(vendorsTotal ?? 0)} />
        <KpiCard label="Vendors (synced)" value={String(vendorsSynced ?? 0)} hint={`from portal`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[color:var(--color-border)] p-5">
          <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-1">Sync clients only</div>
          <p className="text-sm text-[color:var(--color-slate-600)] mb-3">Pull customers + companies from the portal into the local clients table.</p>
          <form action={syncPortalAction}>
            <input type="hidden" name="kind" value="clients" />
            <button type="submit" disabled={!configured} className="px-3 py-2 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] text-white disabled:opacity-40">Sync clients</button>
          </form>
        </div>
        <div className="bg-white rounded-xl border border-[color:var(--color-border)] p-5">
          <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-1">Sync vendors only</div>
          <p className="text-sm text-[color:var(--color-slate-600)] mb-3">Provision active portal vendors as translator profiles (mirrors language pairs into <code className="mono text-xs">profiles.meta</code>).</p>
          <form action={syncPortalAction}>
            <input type="hidden" name="kind" value="vendors" />
            <button type="submit" disabled={!configured} className="px-3 py-2 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] text-white disabled:opacity-40">Sync vendors</button>
          </form>
        </div>
        <div className="bg-white rounded-xl border border-[color:var(--color-border)] p-5">
          <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-1">Full sync</div>
          <p className="text-sm text-[color:var(--color-slate-600)] mb-3">Both at once. Run on first set-up or after bulk portal changes.</p>
          <form action={syncPortalAction}>
            <input type="hidden" name="kind" value="all" />
            <button type="submit" disabled={!configured} className="px-3 py-2 text-sm font-semibold rounded-md bg-[color:var(--color-teal-700)] text-white disabled:opacity-40">Sync everything</button>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[color:var(--color-border)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[color:var(--color-border-soft)] text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)]">
          Recent sync runs
        </div>
        {!recentRuns || recentRuns.length === 0 ? (
          <div className="p-6 text-sm text-[color:var(--color-slate-500)] text-center">No runs yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--color-slate-50)] text-[color:var(--color-slate-500)] text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2 font-bold">When</th>
                <th className="text-left px-4 py-2 font-bold">By</th>
                <th className="text-left px-4 py-2 font-bold">Kind</th>
                <th className="text-left px-4 py-2 font-bold">Status</th>
                <th className="text-left px-4 py-2 font-bold">Clients</th>
                <th className="text-left px-4 py-2 font-bold">Vendors</th>
                <th className="text-left px-4 py-2 font-bold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((r) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const actor = (r as any).profiles;
                return (
                  <tr key={r.id} className="border-t border-[color:var(--color-border-soft)]">
                    <td className="px-4 py-2 text-xs mono">{new Date(r.started_at).toLocaleString()}</td>
                    <td className="px-4 py-2 text-xs">{actor?.email ?? "—"}</td>
                    <td className="px-4 py-2 capitalize">{r.kind}</td>
                    <td className="px-4 py-2">
                      <span className={
                        r.status === "completed" ? "text-[color:var(--color-emerald-700)]"
                        : r.status === "failed" ? "text-[color:var(--color-rose-600)]"
                        : "text-[color:var(--color-amber-600)]"
                      }>{r.status}</span>
                    </td>
                    <td className="px-4 py-2 mono text-xs">+{r.clients_added}/~{r.clients_updated}</td>
                    <td className="px-4 py-2 mono text-xs">+{r.vendors_added}/~{r.vendors_updated}</td>
                    <td className="px-4 py-2 text-xs text-[color:var(--color-rose-600)]">{r.error ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {lastRun && (
        <p className="mt-4 text-xs text-[color:var(--color-slate-500)]">
          Last run: <span className="mono">{new Date(lastRun.started_at).toLocaleString()}</span>
          {lastRun.finished_at && <> · finished <span className="mono">{new Date(lastRun.finished_at).toLocaleString()}</span></>}
        </p>
      )}
    </>
  );
}
