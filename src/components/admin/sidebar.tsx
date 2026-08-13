"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Boxes,
  ChevronRight,
  FileText,
  FolderTree,
  History,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Menu,
  Package,
  Palette,
  Settings,
  ShoppingCart,
  Users,
  UsersRound,
  X,
} from "lucide-react";

import { ADMIN_DESKTOP_MEDIA_QUERY } from "@/components/admin/breakpoints";
// Project convention: overlays portal out. `position: fixed` resolves against the viewport only
// while no ancestor establishes a containing block, and `transform`/`filter`/`backdrop-filter`
// all create one. The admin shell carries none of those today — this is defensive, because such
// an ancestor arrives via a purely visual edit with no signal here. See `Portal`'s own docblock.
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

// Tabbable candidates in document order. Attribute-based only: does not exclude CSS-hidden,
// `[inert]` or `aria-hidden` nodes. Fine while everything in the drawer is unconditionally
// visible; add a conditionally hidden control and the trap will focus a node the browser
// refuses, dropping focus to <body>.
function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

/**
 * The compact-width entry point to the admin sections: a trigger that opens a modal drawer.
 *
 * Below `md` the desktop navigation is hidden outright, so this is the only way to reach the
 * sections — which is why the drawer and that visibility change belong to the same commit.
 *
 * Modal behaviour is implemented, not inherited: focus moves in on open and back to the trigger
 * on close, Tab is confined to the drawer, Escape dismisses it, and the page behind cannot
 * scroll. All of it is undone on close AND on unmount, so a drawer open across a route change
 * cannot strand the body unscrollable or leave a listener attached. The one close path that does
 * not restore focus is the breakpoint auto-close — see below.
 */
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

    // Crossing into the desktop layout hides the trigger, so an open drawer would otherwise be
    // orphaned: still painted, still trapping focus, with no control left to dismiss it.
    const desktopMediaQuery = window.matchMedia(ADMIN_DESKTOP_MEDIA_QUERY);
    const closeForDesktop = () => {
      if (desktopMediaQuery.matches) {
        // Unlike close(), focus is NOT restored: the trigger is `md:hidden` at this width and
        // focusing a display:none element is a silent no-op, so focus falls to <body>. Landing it
        // on the now-visible desktop nav would be better and needs a ref this does not own.
        setIsOpen(false);
      }
    };

    closeRef.current?.focus();
    // Captured rather than reset to "": the admin shell may already own an overflow value, and
    // clobbering it on close would silently change the page behind the drawer.
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

      // Guarding only the two ends is not a trap. Clicking a non-focusable part of the drawer
      // (the title, header padding) parks activeElement on <body>, and Tab from there walks into
      // the page behind the scrim — invisible, pointer-blocked, hidden by aria-modal.
      const active = document.activeElement;
      if (!(active instanceof Node) || !dialogRef.current.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
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
    <div className="border-t border-white/10 p-4 md:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-expanded={isOpen}
        aria-controls="admin-mobile-navigation"
        className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-white/20 px-4 text-sm font-black text-white transition hover:border-brand-accent hover:text-brand-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
        Abrir menú
      </button>

      {isOpen ? (
        <Portal>
          {/* `md:hidden` repeated, not inherited: Portal reparents this to document.body, so the
              wrapper's copy no longer governs it. CSS half of the desktop cleanup. */}
          <div className="fixed inset-0 z-[100] md:hidden">
            {/* Pointer affordance only: it sits outside the dialog, so the trap never reaches it
                and no Tab sequence lands on it. Keyboard dismissal is Escape and the close
                button. A `button` rather than a div so a virtual cursor can still reach it. */}
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
              className="relative flex h-dvh w-[min(22rem,calc(100vw-2rem))] flex-col overflow-y-auto bg-brand-navy text-white shadow-2xl"
            >
              <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
                <h2 id="admin-mobile-navigation-title" className="text-base font-black">
                  Menú de administración
                </h2>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={close}
                  aria-label="Cerrar menú"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </header>

              <AdminNavigationGroups groups={groups} current={current} mobile onNavigate={close} />
            </div>
          </div>
        </Portal>
      ) : null}
    </div>
  );
}

interface AdminNavigationGroupsProps {
  groups: readonly VisibleNavGroup[];
  current: string | null;
  mobile?: boolean;
  onNavigate?: () => void;
}

/**
 * Renders the permitted sections as a list of labelled groups.
 *
 * Each group is a `section` with an accessible name rather than a bare `div`, and its title is a
 * heading rather than a styled paragraph, so assistive technology can enumerate and jump between
 * the groups instead of meeting one flat run of links.
 *
 * The mobile copy takes a distinct landmark name. In a browser only one is ever exposed — the
 * hidden one is `display: none`, so it leaves the accessibility tree — but under jsdom, where
 * Tailwind does not apply, both are present and the tests cannot address one unambiguously. The
 * cost is a screen-reader user hearing "móvil": an implementation detail leaking into the UI.
 * Drop it if the browser-level tests in the next slice make it unnecessary.
 */
function AdminNavigationGroups({ groups, current, mobile = false, onNavigate }: AdminNavigationGroupsProps) {
  return (
    <nav
      aria-label={mobile ? "Secciones de administración móvil" : "Secciones de administración"}
      className={mobile
        ? "flex flex-1 flex-col gap-6 p-4 pb-8"
        : "hidden gap-4 border-b border-white/10 p-4 md:flex md:flex-1 md:flex-col md:gap-6 md:overflow-visible md:border-b-0"}
    >
      {groups.map((group) => (
        <section
          key={group.title ?? "principal"}
          aria-label={group.title ?? "Principal"}
          className="flex flex-col gap-1"
        >
          {group.title ? (
            <h3 className={mobile
              ? "px-4 pb-1 text-[0.65rem] font-black uppercase tracking-[0.15em] text-white/45"
              : "hidden px-4 pb-2 text-[0.65rem] font-black uppercase tracking-[0.15em] text-white/35 md:block"}>
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
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={mobile
                  ? `inline-flex min-h-11 items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent ${active ? "bg-brand-blue text-white shadow-lg shadow-brand-blue/20" : "text-white/75 hover:bg-white/10 hover:text-brand-accent"}`
                  : `group inline-flex items-center gap-3 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${active ? "bg-brand-blue text-white shadow-lg shadow-brand-blue/20" : "text-white/60 hover:bg-white/5 hover:text-brand-accent"}`}
              >
                <Icon aria-hidden="true" className="h-[1.15rem] w-[1.15rem] shrink-0" />
                <span className={mobile ? undefined : "flex-1"}>{item.label}</span>
                {/* Marks the current section on the wide layout, where the row has the space
                    for it. Decorative: aria-current above is what announces the state. */}
                {!mobile && active ? (
                  <ChevronRight aria-hidden="true" className="hidden h-4 w-4 shrink-0 md:block" />
                ) : null}
              </Link>
            );
          })}
        </section>
      ))}
    </nav>
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
      <AdminMobileNavigation groups={visibleGroups} current={current} />
      <AdminNavigationGroups groups={visibleGroups} current={current} />

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
