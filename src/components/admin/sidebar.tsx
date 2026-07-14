"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { hasPermission, type Permission, type Role } from "@/server/auth/rbac";

// `permission` mirrors the guard on each page, so a link is only offered when opening it would
// actually succeed. Keep the two in step: a link whose permission drifts from its page's guard
// either hides a reachable section or advertises a 404.
//
// Filtering here is usability, NOT the security boundary — the pages enforce it server-side.
// rbac.ts is a pure module with no server-only imports, so the real matrix is reused rather
// than a second copy of the rules being maintained in the UI.
const SECTIONS: readonly { href: string; label: string; permission: Permission | null }[] = [
  { href: "/admin", label: "Dashboard", permission: null },
  { href: "/admin/products", label: "Products", permission: "catalog:read" },
  { href: "/admin/categories", label: "Categories", permission: "catalog:read" },
  { href: "/admin/quotes", label: "Quotes", permission: "quote:read" },
  { href: "/admin/leads", label: "Leads", permission: "leads:read" },
  { href: "/admin/inventory", label: "Inventory", permission: "inventory:read" },
  { href: "/admin/documents", label: "Documents", permission: "documents:read" },
  { href: "/admin/design", label: "Design", permission: "design:read" },
  { href: "/admin/users", label: "Users", permission: "admin:access" },
  { href: "/admin/settings", label: "Settings", permission: "settings:read" },
];

// "/admin" prefixes every other admin route, so it only counts as active on an exact match;
// the rest stay active across their nested routes (e.g. /admin/products/<id>).
function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const sections = SECTIONS.filter(
    (section) => section.permission === null || hasPermission(role, section.permission),
  );

  return (
    <nav
      aria-label="Admin sections"
      className="flex gap-1 overflow-x-auto border-b border-white/10 p-4 md:h-full md:w-60 md:flex-col md:overflow-visible md:border-b-0 md:border-r"
    >
      {sections.map((section) => {
        const active = isActive(pathname, section.href);

        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              active
                ? "bg-brand-blue text-white"
                : "text-white/60 hover:bg-white/5 hover:text-brand-accent"
            }`}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
