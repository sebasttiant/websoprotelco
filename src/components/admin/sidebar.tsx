"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/quotes", label: "Quotes" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/documents", label: "Documents" },
  { href: "/admin/design", label: "Design" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/settings", label: "Settings" },
] as const;

// "/admin" prefixes every other admin route, so it only counts as active on an exact match;
// the rest stay active across their nested routes (e.g. /admin/products/<id>).
function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="flex gap-1 overflow-x-auto border-b border-white/10 p-4 md:h-full md:w-60 md:flex-col md:overflow-visible md:border-b-0 md:border-r"
    >
      {SECTIONS.map((section) => {
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
