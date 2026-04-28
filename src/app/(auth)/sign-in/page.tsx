import Link from "next/link";
import { signInAction } from "./actions";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    error_code?: string;
    error_description?: string;
    info?: string;
    next?: string;
    email?: string;
  }>;
}) {
  const sp = await searchParams;
  // Supabase recovery links that have expired or are otherwise invalid land
  // back here as ?error=access_denied&error_code=otp_expired&error_description=…
  // Detect that and surface a friendlier message with a clear next step.
  const isExpiredRecovery =
    sp.error === "access_denied" && sp.error_code === "otp_expired";
  const friendlyError = isExpiredRecovery
    ? "Your password-reset link has expired. Request a new one below."
    : sp.error
    ? decodeURIComponent(sp.error_description ?? sp.error)
    : null;
  // ?info= renders in the green success chip (e.g. "Password updated. Sign
  // in with your new password.") to differentiate from real errors.
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

      {friendlyError && (
        <div className="mt-4 text-sm rounded-md border border-[color:var(--color-rose-100)] bg-[color:var(--color-rose-50)] text-[color:var(--color-rose-600)] px-3 py-2">
          <div>{friendlyError}</div>
          {isExpiredRecovery && (
            <Link
              href="/forgot-password"
              className="mt-2 inline-block text-xs font-semibold text-[color:var(--color-teal-700)] hover:underline"
            >
              Request a new password-reset link →
            </Link>
          )}
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
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)]">Password</label>
            <Link href="/forgot-password" className="text-xs text-[color:var(--color-teal-700)] hover:underline">Forgot password?</Link>
          </div>
          <input
            type="password" name="password" required autoComplete="current-password"
            className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-[color:var(--color-teal)] focus:ring-[3px] focus:ring-[color:var(--color-teal)]/20"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-[color:var(--color-navy)] hover:bg-[color:var(--color-navy-700)] text-white font-semibold py-2.5 text-sm transition"
        >
          Sign in
        </button>
      </form>

      <div className="mt-6 text-xs text-[color:var(--color-slate-500)] text-center">
        Translators usually arrive here via a job link from the vendor portal.
      </div>
    </div>
  );
}
