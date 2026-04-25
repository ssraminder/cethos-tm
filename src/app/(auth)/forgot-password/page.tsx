import Link from "next/link";
import { forgotPasswordAction } from "./actions";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string; email?: string }> }) {
  const sp = await searchParams;
  if (sp.sent) {
    return (
      <div className="bg-white rounded-xl shadow-[var(--shadow-soft)] border border-[color:var(--color-border)] p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-[color:var(--color-emerald-100)] mx-auto flex items-center justify-center text-[color:var(--color-emerald-600)] mb-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 className="text-lg font-bold text-[color:var(--color-navy)]">Check your inbox</h2>
        <p className="text-sm text-[color:var(--color-slate-500)] mt-1">If an account exists for {sp.email}, we've sent reset instructions.</p>
        <Link href="/sign-in" className="inline-block mt-6 text-sm text-[color:var(--color-teal-700)] hover:underline">Back to sign in</Link>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl shadow-[var(--shadow-soft)] border border-[color:var(--color-border)] p-8">
      <h2 className="text-lg font-bold text-[color:var(--color-navy)]">Reset your password</h2>
      <p className="text-sm text-[color:var(--color-slate-500)] mt-1">Enter your email and we'll send you a reset link.</p>
      <form action={forgotPasswordAction} className="mt-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Email</label>
          <input
            type="email" name="email" required autoComplete="email"
            className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-[color:var(--color-teal)] focus:ring-[3px] focus:ring-[color:var(--color-teal)]/20"
          />
        </div>
        <button type="submit" className="w-full rounded-md bg-[color:var(--color-navy)] hover:bg-[color:var(--color-navy-700)] text-white font-semibold py-2.5 text-sm">Send reset link</button>
      </form>
      <Link href="/sign-in" className="block text-center mt-4 text-sm text-[color:var(--color-teal-700)] hover:underline">Back to sign in</Link>
    </div>
  );
}
