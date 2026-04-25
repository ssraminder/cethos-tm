import { notFound } from "next/navigation";
import { getServiceClient } from "@/lib/supabase/server";
import { acceptInviteAction } from "./actions";
import { createHash } from "node:crypto";

export default async function InvitePage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const supabase = await getServiceClient();
  const { data: invite } = await supabase
    .from("invitations")
    .select("id, email, role, expires_at, accepted_at, revoked_at, invited_by")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!invite || invite.accepted_at || invite.revoked_at) notFound();
  if (new Date(invite.expires_at) < new Date()) notFound();

  const { data: inviter } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", invite.invited_by)
    .maybeSingle();

  const roleLabel: Record<string, string> = { admin: "Administrator", pm: "Project Manager", translator: "Translator", reviewer: "Reviewer" };

  return (
    <div className="bg-white rounded-xl shadow-[var(--shadow-soft)] border border-[color:var(--color-border)] p-8">
      <h2 className="text-lg font-bold text-[color:var(--color-navy)]">You're invited</h2>
      <p className="text-sm text-[color:var(--color-slate-500)] mt-1">
        {inviter?.full_name || inviter?.email || "An admin"} invited you to Cethos CAT as a <span className="font-semibold text-[color:var(--color-navy)]">{roleLabel[invite.role] ?? invite.role}</span>.
      </p>

      {sp.error && (
        <div className="mt-4 text-sm rounded-md border border-[color:var(--color-rose-100)] bg-[color:var(--color-rose-50)] text-[color:var(--color-rose-600)] px-3 py-2">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <form action={acceptInviteAction} className="mt-6 space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Email</label>
          <input type="email" value={invite.email} disabled className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-[color:var(--color-slate-50)] px-3 py-2.5 text-sm text-[color:var(--color-slate-500)]"/>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Full name</label>
          <input type="text" name="full_name" required className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-[color:var(--color-teal)] focus:ring-[3px] focus:ring-[color:var(--color-teal)]/20"/>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate-500)] mb-1">Password</label>
          <input type="password" name="password" required minLength={12} className="w-full rounded-md border border-[color:var(--color-slate-200)] bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-[color:var(--color-teal)] focus:ring-[3px] focus:ring-[color:var(--color-teal)]/20"/>
          <p className="text-xs text-[color:var(--color-slate-500)] mt-1">At least 12 characters.</p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="terms" required className="mt-0.5"/>
          <span className="text-[color:var(--color-slate-600)]">I agree to the Terms of Service and Privacy Policy.</span>
        </label>
        <button type="submit" className="w-full rounded-md bg-[color:var(--color-navy)] hover:bg-[color:var(--color-navy-700)] text-white font-semibold py-2.5 text-sm">Create account</button>
      </form>
    </div>
  );
}
