"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, FileText, FolderTree, LayoutDashboard, type LucideIcon, Package, Palette, Settings, Users, UsersRound } from "lucide-react";

import { hasPermission, type Permission, type Role } from "@/server/auth/rbac";

// Each item's `permission` mirrors the guard on its page, so a link is only offered when opening
// it would actually succeed. Keep the two in step: a link whose permission drifts from its page's
// guard either hides a reachable section or advertises a 404.
//
// Filtering here is usability, NOT the security boundary — the pages enforce it server-side.
// rbac.ts is a pure module with no server-only imports, so the real matrix is reused rather than
// a second copy of the rules being maintained in the UI.
interface NavItem {
  href: string;
  label: string;
  permission: Permission | null;
  icon: LucideIcon;
}

interface NavGroup {
  // `title` is null for the top-level dashboard, which stands alone without a heading.
  title: string | null;
  items: readonly NavItem[];
}

const GROUPS: readonly NavGroup[] = [
  {
    title: null,
    items: [{ href: "/admin", label: "Panel de control", permission: null, icon: LayoutDashboard }],
  },
  {
    title: "Catálogo",
    items: [
      { href: "/admin/products", label: "Productos", permission: "catalog:read", icon: Package },
      { href: "/admin/categories", label: "Categorías", permission: "catalog:read", icon: FolderTree },
    ],
  },
  {
    title: "Operaciones",
    items: [
      { href: "/admin/quotes", label: "Cotizaciones", permission: "quote:read", icon: FileText },
      { href: "/admin/leads", label: "Clientes potenciales", permission: "leads:read", icon: UsersRound },
      { href: "/admin/inventory", label: "Inventario", permission: "inventory:read", icon: Boxes },
    ],
  },
  {
    title: "Contenido",
    items: [
      { href: "/admin/documents", label: "Documentos", permission: "documents:read", icon: FileText },
      { href: "/admin/design", label: "Diseño del sitio", permission: "design:read", icon: Palette },
    ],
  },
  {
    title: "Administración",
    items: [
      { href: "/admin/users", label: "Usuarios", permission: "admin:access", icon: Users },
      { href: "/admin/settings", label: "Configuración", permission: "settings:read", icon: Settings },
    ],
  },
];

// "/admin" prefixes every other admin route, so it only counts as active on an exact match; the
// rest stay active across their nested routes (e.g. /admin/products/<id>).
function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminSidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  const visibleGroups = GROUPS.map((group) => ({
    title: group.title,
    items: group.items.filter(
      (item) => item.permission === null || hasPermission(role, item.permission),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <nav
      aria-label="Secciones de administración"
      className="flex gap-4 overflow-x-auto border-b border-white/10 p-4 md:h-full md:w-60 md:flex-col md:gap-5 md:overflow-visible md:border-b-0 md:border-r"
    >
      {visibleGroups.map((group) => (
        <div key={group.title ?? "principal"} className="flex gap-1 md:flex-col md:gap-1">
          {group.title ? (
            <p className="hidden px-3 pb-1 text-[0.65rem] font-black uppercase tracking-widest text-white/40 md:block">
              {group.title}
            </p>
          ) : null}
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-2.5 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                  active
                    ? "bg-brand-blue text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-brand-accent"
                }`}
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
