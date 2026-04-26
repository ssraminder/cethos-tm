import { headers } from "next/headers";
import { AppShell, NavItem } from "@/components/AppShell";
import { requireRole } from "@/lib/auth/current-user";

const navItems: Omit<NavItem, "active">[] = [
  { label: "Dashboard",          href: "/admin" },
  { label: "Projects",           href: "/admin/projects" },
  { label: "Translation Memory", href: "/admin/tm" },
  { label: "Termbases",          href: "/admin/termbases" },
  { label: "QA Profiles",        href: "/admin/qa" },
  { label: "Languages",          href: "/admin/languages" },
  { label: "MT Engines",         href: "/admin/mt" },
  { label: "Users",              href: "/admin/users" },
  { label: "Integrations",       href: "/admin/integrations" },
  { label: "Audit Log",          href: "/admin/audit" },
  { label: "Settings",           href: "/admin/settings" },
  { label: "Training",           href: "/admin/training" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["admin"]);
  const h = await headers();
  const path = h.get("x-pathname") || h.get("referer") || "";

  const nav: NavItem[] = navItems.map((n) => ({
    ...n,
    active: path.endsWith(n.href) || (n.href !== "/admin" && path.includes(n.href)),
  }));

  return (
    <AppShell
      brand="Admin"
      brandTagline="Linguistic operations"
      user={{ name: user.full_name, email: user.email, role: "Administrator" }}
      nav={nav}
    >
      {children}
    </AppShell>
  );
}
