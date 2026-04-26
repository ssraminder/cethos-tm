import { headers } from "next/headers";
import { AppShell, NavItem } from "@/components/AppShell";
import { requireRole } from "@/lib/auth/current-user";

const navItems: Omit<NavItem, "active">[] = [
  { label: "Dashboard",    href: "/pm" },
  { label: "Projects",     href: "/pm/projects" },
  { label: "Jobs",         href: "/pm/jobs" },
  { label: "Create job",   href: "/pm/jobs/new" },
  { label: "Translators",  href: "/pm/translators" },
  { label: "Concordance",  href: "/pm/concordance" },
  { label: "Reports",      href: "/pm/reports" },
  { label: "Training",     href: "/pm/training" },
];

export default async function PmLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["pm", "admin"]);
  const h = await headers();
  const path = h.get("x-pathname") || h.get("referer") || "";
  const nav: NavItem[] = navItems.map((n) => ({
    ...n,
    active: path.endsWith(n.href) || (n.href !== "/pm" && path.includes(n.href)),
  }));
  return (
    <AppShell
      brand="PM"
      brandTagline="Linguistic supervision"
      user={{ name: user.full_name, email: user.email, role: "Project Manager" }}
      nav={nav}
    >
      {children}
    </AppShell>
  );
}
