import { PageHeader } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { changeProfilePasswordAction } from "./actions";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const me = await getCurrentUser();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Profile" subtitle="Your rates and language pairs are managed in the vendor portal." />
      <div className="bg-white rounded-xl border border-[color:var(--color-border)] p-6 max-w-xl mb-4">
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
            <div className="text-[color:var(--color-navy)] capitalize">{me.status}</div>
          </div>
        </div>
      </div>

      {sp.saved && (
        <div className="mb-4 max-w-xl text-sm rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2">
          Password updated.
        </div>
      )}
      {sp.error && (
        <div className="mb-4 max-w-xl text-sm rounded-md border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <form
        action={changeProfilePasswordAction}
        className="bg-white rounded-xl border border-[color:var(--color-border)] p-6 max-w-xl"
      >
        <h2 className="text-sm font-semibold text-[color:var(--color-navy)] mb-1">Change password</h2>
        <p className="text-xs text-[color:var(--color-slate-500)] mb-4">
          Enter a new password (at least 12 characters). You'll keep using the same email to sign in.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">
              New password
            </label>
            <input
              type="password"
              name="password"
              required
              autoComplete="new-password"
              minLength={12}
              className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--color-teal)] focus:ring-[3px] focus:ring-[color:var(--color-teal)]/20"
              placeholder="At least 12 characters"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">
              Confirm new password
            </label>
            <input
              type="password"
              name="confirm"
              required
              autoComplete="new-password"
              minLength={12}
              className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--color-teal)] focus:ring-[3px] focus:ring-[color:var(--color-teal)]/20"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-[color:var(--color-navy)] hover:bg-[color:var(--color-navy-700)] text-white font-semibold px-4 py-2 text-sm transition"
          >
            Update password
          </button>
        </div>
      </form>
    </>
  );
}
