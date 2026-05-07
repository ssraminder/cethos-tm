import { PageHeader } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function ProfilePage() {
  const me = await getCurrentUser();
  return (
    <>
      <PageHeader title="Profile" subtitle="Your rates and language pairs are managed in the vendor portal. Sign-in is by email OTP — no password to manage." />
      <div className="bg-white rounded-xl border border-[color:var(--color-border)] p-6 max-w-xl">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wide text-[color:var(--color-slate-500)] font-bold mb-1">Email</div>
            <div className="text-[color:var(--color-navy)]">{me.email}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-[color:var(--color-slate-500)] font-bold mb-1">Name</div>
            <div className="text-[color:var(--color-navy)]">{me.full_name ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-[color:var(--color-slate-500)] font-bold mb-1">Role</div>
            <div className="text-[color:var(--color-navy)] capitalize">{me.role}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-[color:var(--color-slate-500)] font-bold mb-1">Status</div>
            <div className="text-[color:var(--color-navy)] capitalize">{me.is_active ? "active" : "inactive"}</div>
          </div>
        </div>
      </div>
    </>
  );
}
