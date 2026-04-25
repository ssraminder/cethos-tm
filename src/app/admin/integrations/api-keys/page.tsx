import { PageHeader } from "@/components/AppShell";
import { getServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/current-user";
import { mintApiKeyAction, revokeApiKeyAction } from "./actions";

export default async function ApiKeysPage({
  searchParams,
}: {
  searchParams: Promise<{ minted?: string; error?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const supabase = await getServiceClient();
  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, name, scope, key_prefix, last_used_at, created_at, revoked_at, expires_at, client_id")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="API keys"
        subtitle="Bearer tokens for the TMS ingest API and webhook callbacks. Treat them like passwords."
      />

      {sp.minted && (
        <div className="mb-4 rounded-md border border-[color:var(--color-emerald-100)] bg-[color:var(--color-emerald-50)] text-[color:var(--color-emerald-700)] px-4 py-3">
          <div className="font-bold mb-1">Key minted — copy it now. We won't show it again.</div>
          <div className="mono text-xs break-all bg-white px-2 py-1.5 rounded border border-[color:var(--color-border)]">{sp.minted}</div>
        </div>
      )}
      {sp.error && (
        <div className="mb-4 rounded-md border border-[color:var(--color-rose-100)] bg-[color:var(--color-rose-50)] text-[color:var(--color-rose-600)] px-3 py-2 text-sm">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <form action={mintApiKeyAction} className="bg-white rounded-xl border border-[color:var(--color-border)] p-5 mb-6 max-w-2xl">
        <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)] mb-3">Mint new key</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Name</label>
            <input type="text" name="name" required maxLength={120}
              className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2 text-sm" placeholder="e.g. Acme TMS Integration" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Scope</label>
            <select name="scope" defaultValue="tms_ingest" className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2 text-sm">
              <option value="tms_ingest">TMS ingest</option>
              <option value="webhook_callback">Webhook callback</option>
            </select>
          </div>
        </div>
        <button type="submit" className="px-3 py-2 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] text-white">Mint key</button>
      </form>

      {!keys || keys.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-[color:var(--color-border)] p-8 text-center text-sm text-[color:var(--color-slate-500)]">
          No keys yet.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[color:var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--color-slate-50)] text-[color:var(--color-slate-500)] text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2 font-bold">Name</th>
                <th className="text-left px-4 py-2 font-bold">Scope</th>
                <th className="text-left px-4 py-2 font-bold">Prefix</th>
                <th className="text-left px-4 py-2 font-bold">Last used</th>
                <th className="text-left px-4 py-2 font-bold">Status</th>
                <th className="text-left px-4 py-2 font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-t border-[color:var(--color-border-soft)]">
                  <td className="px-4 py-2 font-semibold text-[color:var(--color-navy)]">{k.name}</td>
                  <td className="px-4 py-2 capitalize">{k.scope.replace("_", " ")}</td>
                  <td className="px-4 py-2 mono text-xs">{k.key_prefix}…</td>
                  <td className="px-4 py-2 text-xs text-[color:var(--color-slate-500)]">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "Never"}</td>
                  <td className="px-4 py-2">
                    {k.revoked_at ? <span className="text-[color:var(--color-rose-600)]">Revoked</span>
                      : k.expires_at && new Date(k.expires_at) < new Date() ? <span className="text-[color:var(--color-amber-600)]">Expired</span>
                      : <span className="text-[color:var(--color-emerald-700)]">Active</span>}
                  </td>
                  <td className="px-4 py-2">
                    {!k.revoked_at && (
                      <form action={revokeApiKeyAction}>
                        <input type="hidden" name="key_id" value={k.id} />
                        <button type="submit" className="text-xs font-semibold text-[color:var(--color-rose-600)] hover:underline">Revoke</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
