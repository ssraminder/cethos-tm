import { signInAction } from "./actions";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    info?: string;
    next?: string;
    email?: string;
  }>;
}) {
  const sp = await searchParams;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const infoMsg = sp.info ? decodeURIComponent(sp.info) : null;
  return (
    <div className="bg-white rounded-xl shadow-[var(--shadow-soft)] border border-[color:var(--color-border)] p-8">
      <h2 className="text-xl font-bold text-[color:var(--color-navy)]">Sign in to Cethos CAT</h2>
      <p className="text-sm text-[color:var(--color-slate-500)] mt-1">Translation memory, terminology, MT, and QA.</p>

      {infoMsg && (
        <div className="mt-4 text-sm rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2">
          {infoMsg}
        </div>
      )}

      {errorMsg && (
        <div className="mt-4 text-sm rounded-md border border-[color:var(--color-rose-100)] bg-[color:var(--color-rose-50)] text-[color:var(--color-rose-600)] px-3 py-2">
          {errorMsg}
        </div>
      )}

      <form action={signInAction} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Email</label>
          <input
            type="email" name="email" required autoComplete="email" defaultValue={sp.email ?? ""}
            className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-[color:var(--color-teal)] focus:ring-[3px] focus:ring-[color:var(--color-teal)]/20"
            placeholder="you@cethos.com"
            autoFocus
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-[color:var(--color-navy)] hover:bg-[color:var(--color-navy-700)] text-white font-semibold py-2.5 text-sm transition"
        >
          Send sign-in code
        </button>
      </form>

      <div className="mt-6 text-xs text-[color:var(--color-slate-500)] text-center">
        We'll email you a 6-digit code to sign in. No password needed.
      </div>
    </div>
  );
}
