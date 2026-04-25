import { headers } from "next/headers";
import { AppShell, NavItem } from "@/components/AppShell";
import { requireRole } from "@/lib/auth/current-user";

const navItems: Omit<NavItem, "active">[] = [
  { label: "Inbox",       href: "/translator" },
  { label: "Concordance", href: "/translator/concordance" },
  { label: "Profile",     href: "/translator/profile" },
];

export default async function TranslatorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["translator", "reviewer", "admin", "pm"]);
  const h = await headers();
  const path = h.get("x-pathname") || h.get("referer") || "";
  const nav: NavItem[] = navItems.map((n) => ({
    ...n,
    active: path.endsWith(n.href) || (n.href !== "/translator" && path.includes(n.href)),
  }));
  return (
    <AppShell
      brand="CAT"
      brandTagline="Workbench"
      user={{ name: user.full_name, email: user.email, role: user.role === "reviewer" ? "Reviewer" : "Translator" }}
      nav={nav}
    >
      {children}
    </AppShell>
  );
}
