"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ChevronRight,
  FileText,
  FolderTree,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Package,
  Palette,
  Settings,
  ShoppingCart,
  Users,
  UsersRound,
} from "lucide-react";

// signOut carries "use server", so importing it here ships an RPC reference rather than any
// server code. Keeping the control in the sidebar puts it where the mockups place it, below
// the sections, instead of in the top bar.
import { signOut } from "@/server/auth/actions";
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
    title: "Principal",
    items: [
      { href: "/admin", label: "Panel de control", permission: null, icon: LayoutDashboard },
      // Orders and quotes are the same table split by `kind`, so they share one permission.
      { href: "/admin/orders", label: "Pedidos", permission: "quote:read", icon: ShoppingCart },
      { href: "/admin/leads", label: "Clientes potenciales", permission: "leads:read", icon: UsersRound },
      { href: "/admin/quotes", label: "Cotizaciones", permission: "quote:read", icon: FileText },
    ],
  },
  {
    title: "Inventario",
    items: [
      { href: "/admin/products", label: "Productos", permission: "catalog:read", icon: Package },
      { href: "/admin/inventory", label: "Gestión de stock", permission: "inventory:read", icon: Boxes },
      { href: "/admin/categories", label: "Categorías", permission: "catalog:read", icon: FolderTree },
    ],
  },
  {
    title: "Diseño y sitio",
    items: [
      { href: "/admin/design", label: "Apariencia", permission: "design:read", icon: Palette },
      { href: "/admin/documents", label: "Documentación", permission: "documents:read", icon: FileText },
    ],
  },
  // The legacy panel filed Usuarios under "Diseño y sitio". Access control is not design, and
  // the grouping is what tells a new operator where to look, so these keep their own heading —
  // which also makes this the one group a staff user can open nothing in, exercising the
  // empty-group rule below.
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
    <div className="flex flex-col md:min-h-0 md:flex-1">
      <nav
        aria-label="Secciones de administración"
        className="flex gap-4 overflow-x-auto border-b border-white/10 p-4 md:flex-1 md:flex-col md:gap-6 md:overflow-visible md:border-b-0"
      >
        {visibleGroups.map((group) => (
          <div key={group.title ?? "principal"} className="flex gap-1 md:flex-col md:gap-1">
            {group.title ? (
              <p className="hidden px-4 pb-2 text-[0.65rem] font-black uppercase tracking-[0.15em] text-white/35 md:block">
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
                  className={`group inline-flex items-center gap-3 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                    active
                      ? "bg-brand-blue text-white shadow-lg shadow-brand-blue/20"
                      : "text-white/60 hover:bg-white/5 hover:text-brand-accent"
                  }`}
                >
                  <Icon aria-hidden="true" className="h-[1.15rem] w-[1.15rem] shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {/* Marks the current section on the wide layout, where the row has the space
                      for it. Decorative: aria-current above is what announces the state. */}
                  {active ? (
                    <ChevronRight aria-hidden="true" className="hidden h-4 w-4 shrink-0 md:block" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <form action={signOut} className="hidden border-t border-white/10 p-4 md:block">
        <button
          type="submit"
          className="inline-flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut aria-hidden="true" className="h-[1.15rem] w-[1.15rem] shrink-0" />
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
