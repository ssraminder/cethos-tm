import { PageHeader, PlaceholderCard } from "@/components/AppShell";
import { getServiceClient } from "@/lib/supabase/server";

export default async function UsersPage() {
  const supabase = await getServiceClient();
  const { data: users } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Admin, PM, and direct-login translators. Vendor-portal translators are managed in the vendor portal."
        actions={<button className="px-3 py-2 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] text-white">Invite user</button>}
      />
      {!users || users.length === 0 ? (
        <PlaceholderCard title="No users yet" body="Invite the first admin or PM to get started." />
      ) : (
        <div className="bg-white rounded-xl border border-[color:var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--color-slate-50)] text-[color:var(--color-slate-500)] text-xs uppercase tracking-wide">
              <tr><th className="text-left px-4 py-2 font-bold">Email</th><th className="text-left px-4 py-2 font-bold">Name</th><th className="text-left px-4 py-2 font-bold">Role</th><th className="text-left px-4 py-2 font-bold">Auth</th><th className="text-left px-4 py-2 font-bold">Status</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-[color:var(--color-border-soft)]">
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2">{u.full_name ?? "—"}</td>
                  <td className="px-4 py-2 capitalize">{u.role}</td>
                  <td className="px-4 py-2 capitalize">{u.auth_source.replace("_", " ")}</td>
                  <td className="px-4 py-2 capitalize">{u.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
