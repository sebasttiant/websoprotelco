"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Boxes,
  ChevronRight,
  FileText,
  FolderTree,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  type LucideIcon,
  Package,
  Palette,
  Settings,
  ShoppingCart,
  Users,
  UsersRound,
  X,
} from "lucide-react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { Portal } from "@/components/ui/portal";
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
      { href: "/admin/reports", label: "Reportes", permission: "quote:read", icon: BarChart3 },
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
      { href: "/admin/inventory/movements", label: "Historial de movimientos", permission: "inventory:read", icon: History },
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
// rest match across their nested routes (e.g. /admin/products/<id>).
function matchesRoute(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

/**
 * The href of the single section to mark active: the LONGEST match wins.
 *
 * Prefix matching alone lights up two rows at once whenever one section nests under another —
 * /admin/inventory/movements matches both itself and /admin/inventory. Telling the operator
 * they are in two places is worse than telling them nothing.
 */
function activeHref(pathname: string, items: readonly NavItem[]): string | null {
  return items
    .filter((item) => matchesRoute(pathname, item.href))
    .reduce<string | null>(
      (best, item) => (best === null || item.href.length > best.length ? item.href : best),
      null,
    );
}

interface VisibleNavGroup {
  title: string | null;
  items: NavItem[];
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

function AdminMobileNavigation({
  groups,
  current,
}: {
  groups: readonly VisibleNavGroup[];
  current: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  function close(): void {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!isOpen) return;

    const desktopMediaQuery = window.matchMedia("(min-width: 768px)");
    const closeForDesktop = () => {
      if (desktopMediaQuery.matches) {
        setIsOpen(false);
      }
    };

    // Tailwind only hides the drawer at md+. Close its state too, so the modal's global
    // listeners and body-scroll lock cannot survive an orientation change or resize.
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = focusableElements(dialogRef.current);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    desktopMediaQuery.addEventListener("change", closeForDesktop);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      desktopMediaQuery.removeEventListener("change", closeForDesktop);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-expanded={isOpen}
        aria-controls="admin-mobile-navigation"
        aria-label="Abrir menú"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/20 text-white transition hover:border-brand-accent hover:text-brand-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent md:hidden"
      >
        <Menu aria-hidden="true" className="h-4 w-4" />
      </button>

      {isOpen ? (
        <Portal>
          <div className="fixed inset-0 z-[100] md:hidden">
            <button
              type="button"
              aria-label="Cerrar menú al hacer clic fuera"
              onClick={close}
              className="absolute inset-0 bg-brand-navy/55 backdrop-blur-sm"
            />
            <div
              ref={dialogRef}
              id="admin-mobile-navigation"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-mobile-navigation-title"
              className="relative flex h-dvh w-[min(20rem,calc(100vw-1.5rem))] flex-col overflow-y-auto bg-brand-navy text-white shadow-2xl"
            >
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <h2 id="admin-mobile-navigation-title" className="text-sm font-black">
                  Menú
                </h2>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={close}
                  aria-label="Cerrar menú"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </header>

              <nav aria-label="Secciones de administración móvil" className="flex flex-1 flex-col gap-5 p-3 pb-6">
                {groups.map((group) => (
                  <section
                    key={group.title ?? "principal"}
                    aria-label={group.title ?? "Principal"}
                    className="flex flex-col gap-0.5"
                  >
                    {group.title ? (
                      <h3 className="px-3 pb-1 text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/45">
                        {group.title}
                      </h3>
                    ) : null}
                    {group.items.map((item) => {
                      const active = current === item.href;
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={close}
                          aria-current={active ? "page" : undefined}
                          className={`inline-flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent ${
                            active
                              ? "bg-brand-blue text-white shadow-md shadow-brand-blue/20"
                              : "text-white/75 hover:bg-white/10 hover:text-brand-accent"
                          }`}
                        >
                          <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </section>
                ))}
              </nav>
            </div>
          </div>
        </Portal>
      ) : null}
    </>
  );
}

export function AdminSidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  const visibleGroups = GROUPS.map((group) => ({
    title: group.title,
    items: group.items.filter(
      (item) => item.permission === null || hasPermission(role, item.permission),
    ),
  })).filter((group) => group.items.length > 0);

  // Resolved across the VISIBLE items, not the full list: a section hidden from this role must
  // not win the match and leave no row highlighted at all.
  const current = activeHref(pathname, visibleGroups.flatMap((group) => group.items));

  return (
    <div className="flex flex-col md:min-h-0 md:flex-1">
      <div className="flex items-center justify-between gap-3 px-3 py-3 md:block md:px-4 md:pb-2 md:pt-5">
        <Link href="/admin" className="flex min-w-0 items-center gap-2.5" aria-label="SOPROTELCO panel">
          <BrandLogo alt="SOPROTELCO" tone="dark" size="sm" className="md:h-11" />
          <span className="shrink-0 text-[0.65rem] font-black uppercase tracking-widest text-brand-accent">Panel</span>
        </Link>
        <AdminMobileNavigation groups={visibleGroups} current={current} />
      </div>

      <nav
        aria-label="Secciones de administración"
        className="hidden gap-4 p-3 md:flex md:flex-1 md:flex-col md:gap-5 md:overflow-visible md:px-3 md:pb-3"
      >
        {visibleGroups.map((group) => (
          <section
            key={group.title ?? "principal"}
            aria-label={group.title ?? "Principal"}
            className="flex flex-col gap-0.5"
          >
            {group.title ? (
              <h3 className="px-3 pb-1.5 text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/35">
                {group.title}
              </h3>
            ) : null}
            {group.items.map((item) => {
              const active = current === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`group inline-flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold transition ${
                    active
                      ? "bg-brand-blue text-white shadow-md shadow-brand-blue/20"
                      : "text-white/60 hover:bg-white/5 hover:text-brand-accent"
                  }`}
                >
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {active ? (
                    <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                  ) : null}
                </Link>
              );
            })}
          </section>
        ))}
      </nav>

      <form action={signOut} className="mt-auto hidden border-t border-white/10 p-3 md:block">
        <button
          type="submit"
          className="inline-flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-bold text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut aria-hidden="true" className="h-4 w-4 shrink-0" />
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
