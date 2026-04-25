import { resetPasswordAction } from "./actions";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="bg-white rounded-xl shadow-[var(--shadow-soft)] border border-[color:var(--color-border)] p-8">
      <h2 className="text-lg font-bold text-[color:var(--color-navy)]">Set a new password</h2>
      <p className="text-sm text-[color:var(--color-slate-500)] mt-1">You'll be signed out of other devices.</p>
      {sp.error && (
        <div className="mt-4 text-sm rounded-md border border-[color:var(--color-rose-100)] bg-[color:var(--color-rose-50)] text-[color:var(--color-rose-600)] px-3 py-2">
          {decodeURIComponent(sp.error)}
        </div>
      )}
      <form action={resetPasswordAction} className="mt-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">New password</label>
          <input type="password" name="password" required minLength={12}
            className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-[color:var(--color-teal)] focus:ring-[3px] focus:ring-[color:var(--color-teal)]/20"/>
          <p className="text-xs text-[color:var(--color-slate-500)] mt-1">At least 12 characters, mix of letters, numbers, and symbols.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Confirm</label>
          <input type="password" name="confirm" required minLength={12}
            className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-[color:var(--color-teal)] focus:ring-[3px] focus:ring-[color:var(--color-teal)]/20"/>
        </div>
        <button type="submit" className="w-full rounded-md bg-[color:var(--color-navy)] hover:bg-[color:var(--color-navy-700)] text-white font-semibold py-2.5 text-sm">Update password</button>
      </form>
    </div>
  );
}
