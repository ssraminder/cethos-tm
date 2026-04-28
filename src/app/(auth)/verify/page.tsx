import { redirect } from "next/navigation";
import { verifyAction, resendAction } from "./actions";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string; next?: string; resent?: string }>;
}) {
  const sp = await searchParams;
  // OTP-only flow: no Supabase session exists at this point — it gets minted
  // after successful OTP verification. The page just renders the code form.
  // Bounce to /sign-in only if we somehow got here without an email param.
  if (!sp.email) redirect("/sign-in");
  const email = sp.email;
  const masked = email.replace(/(.).*(@.*)/, "$1***$2");

  return (
    <div className="bg-white rounded-xl shadow-[var(--shadow-soft)] border border-[color:var(--color-border)] p-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[color:var(--color-teal-50)] text-[color:var(--color-teal-700)] flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-[color:var(--color-navy)]">Verify it's you</h2>
          <p className="text-sm text-[color:var(--color-slate-500)]">Code sent to <span className="font-medium text-[color:var(--color-navy)]">{masked}</span></p>
        </div>
      </div>

      {sp.error && (
        <div className="mt-4 text-sm rounded-md border border-[color:var(--color-rose-100)] bg-[color:var(--color-rose-50)] text-[color:var(--color-rose-600)] px-3 py-2">
          {decodeURIComponent(sp.error)}
        </div>
      )}
      {sp.resent && (
        <div className="mt-4 text-sm rounded-md border border-[color:var(--color-emerald-100)] bg-[color:var(--color-emerald-50)] text-[color:var(--color-emerald-700)] px-3 py-2">
          A new code has been sent. It expires in 10 minutes.
        </div>
      )}

      <form action={verifyAction} className="mt-6 space-y-4">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-2">6-digit code</label>
          <input
            type="text" name="code" required inputMode="numeric" pattern="\d{6}" maxLength={6} autoFocus
            className="mono w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-3 text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-[color:var(--color-teal)] focus:ring-[3px] focus:ring-[color:var(--color-teal)]/20"
            placeholder="000000"
          />
          <p className="text-xs text-[color:var(--color-slate-500)] mt-1.5">Code expires in 10 minutes.</p>
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-[color:var(--color-navy)] hover:bg-[color:var(--color-navy-700)] text-white font-semibold py-2.5 text-sm transition"
        >
          Verify
        </button>
      </form>

      <form action={resendAction} className="mt-3">
        <input type="hidden" name="email" value={email} />
        <button
          type="submit"
          className="w-full text-sm text-[color:var(--color-teal-700)] hover:underline py-1.5"
        >
          Resend code
        </button>
      </form>
    </div>
  );
}
