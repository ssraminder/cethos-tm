import Link from "next/link";
import { ReactNode } from "react";
import { signOutAction } from "@/app/(auth)/sign-in/actions";

export interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
  active?: boolean;
  badge?: string | number;
}

export interface AppShellProps {
  user: { name?: string | null; email?: string | null; role?: string | null } | null;
  nav: NavItem[];
  brand: string;
  brandTagline?: string;
  breadcrumb?: string;
  children: ReactNode;
}

export function AppShell({ user, nav, brand, brandTagline, breadcrumb, children }: AppShellProps) {
  const initials = (user?.name || user?.email || "?").trim().slice(0, 2).toUpperCase();
  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-bg-app)" }}>
      <aside className="w-[240px] shrink-0 bg-white border-r border-[color:var(--color-border)] flex flex-col">
        <div className="h-14 px-4 flex items-center border-b border-[color:var(--color-border)]">
          <Link href="/" className="text-base font-extrabold tracking-tight text-[color:var(--color-navy)]">
            Cethos<span className="text-[color:var(--color-teal)]">.</span><span className="ml-1 font-bold text-[color:var(--color-slate-500)] text-sm">{brand}</span>
          </Link>
        </div>
        {brandTagline && (
          <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)]">
            {brandTagline}
          </div>
        )}
        <nav className="flex-1 px-2 py-2 overflow-y-auto">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition mb-0.5",
                item.active
                  ? "bg-[color:var(--color-bg-blue)] text-[color:var(--color-teal-700)]"
                  : "text-[color:var(--color-slate-700)] hover:bg-[color:var(--color-slate-50)]",
              ].join(" ")}
            >
              {item.icon && <span className="w-4 h-4 flex items-center justify-center">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
              {item.badge !== undefined && (
                <span className="text-[10px] font-bold rounded-full bg-[color:var(--color-rose-500)] text-white px-1.5 py-0.5">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="border-t border-[color:var(--color-border)] p-3 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[color:var(--color-navy)] text-white flex items-center justify-center text-xs font-bold">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[color:var(--color-navy)] truncate">{user?.name || user?.email || "—"}</div>
            <div className="text-[11px] text-[color:var(--color-slate-500)] truncate">{user?.role || ""}</div>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              title="Sign out"
              className="text-[color:var(--color-slate-500)] hover:text-[color:var(--color-rose-600)] p-1"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-[color:var(--color-border)] px-6 flex items-center gap-4">
          <div className="text-sm text-[color:var(--color-slate-500)]">{breadcrumb}</div>
          <div className="flex-1" />
          <div className="text-xs text-[color:var(--color-slate-500)]">⌘K to search</div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="px-8 py-6 max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--color-navy)] tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-[color:var(--color-slate-500)] mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-xl border border-[color:var(--color-border)] p-4 shadow-[var(--shadow-soft)]">
      <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--color-slate-500)]">{label}</div>
      <div className="mt-2 text-2xl font-extrabold text-[color:var(--color-navy)]">{value}</div>
      {hint && <div className="text-xs text-[color:var(--color-slate-500)] mt-1">{hint}</div>}
    </div>
  );
}

export function PlaceholderCard({ title, body }: { title: string; body?: string }) {
  return (
    <div className="bg-white rounded-xl border border-dashed border-[color:var(--color-border)] p-8 text-center">
      <div className="font-semibold text-[color:var(--color-navy)]">{title}</div>
      {body && <div className="text-sm text-[color:var(--color-slate-500)] mt-1">{body}</div>}
    </div>
  );
}
