"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { signOut } from "@/server/auth/actions";

export interface HeaderNavLink {
  href: string;
  label: string;
}

export interface HeaderMobileCategory {
  slug: string;
  name: string;
}

export function HeaderMobileMenu({
  links,
  categories = [],
  isSignedIn = false,
}: {
  links: readonly HeaderNavLink[];
  categories?: readonly HeaderMobileCategory[];
  isSignedIn?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
        className="grid h-11 w-11 place-items-center rounded-2xl border border-brand-line text-brand-navy transition hover:border-brand-accent hover:text-brand-blue"
      >
        <span aria-hidden="true" className="relative block h-4 w-5">
          <span
            className={`absolute left-0 block h-0.5 w-5 bg-current transition-transform ${isOpen ? "top-1.5 rotate-45" : "top-0"}`}
          />
          <span
            className={`absolute left-0 top-1.5 block h-0.5 w-5 bg-current transition-opacity ${isOpen ? "opacity-0" : "opacity-100"}`}
          />
          <span
            className={`absolute left-0 block h-0.5 w-5 bg-current transition-transform ${isOpen ? "top-1.5 -rotate-45" : "top-3"}`}
          />
        </span>
      </button>

      {isOpen ? (
        <nav
          aria-label="Navegación móvil"
          className="absolute inset-x-0 top-full border-b border-brand-line bg-white p-4 shadow-lg shadow-blue-950/5"
        >
          <form action="/productos" method="get" role="search" className="mb-4 flex items-center rounded-full border border-brand-line bg-brand-ice pl-4 pr-1.5 focus-within:border-brand-accent">
            <label htmlFor="mobile-search" className="sr-only">
              Buscar productos
            </label>
            <input
              id="mobile-search"
              type="search"
              name="q"
              placeholder="Buscar productos..."
              className="w-full bg-transparent py-2.5 text-sm font-medium text-brand-navy outline-none placeholder:text-brand-muted"
            />
            <button
              type="submit"
              aria-label="Buscar"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-blue text-white transition hover:bg-brand-primary"
            >
              <Search aria-hidden="true" className="h-4 w-4" />
            </button>
          </form>

          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="block rounded-xl px-4 py-3 text-sm font-black text-brand-navy transition hover:bg-brand-ice hover:text-brand-blue"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {categories.length > 0 ? (
            <div className="mt-3 border-t border-brand-line pt-3">
              <p className="px-4 pb-1 text-xs font-black uppercase tracking-widest text-brand-muted">Categorías</p>
              <ul className="flex flex-col gap-1">
                {categories.map((category) => (
                  <li key={category.slug}>
                    <Link
                      href={`/productos/${category.slug}`}
                      onClick={() => setIsOpen(false)}
                      className="block rounded-xl px-4 py-2.5 text-sm font-bold text-brand-navy transition hover:bg-brand-ice hover:text-brand-blue"
                    >
                      {category.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* The header's account controls are hidden below the sm breakpoint, so this is the
              only way into (or out of) the account on a phone. */}
          {isSignedIn ? (
            <>
              <Link
                href="/cuenta"
                onClick={() => setIsOpen(false)}
                className="mt-3 block rounded-full bg-brand-navy px-5 py-3 text-center text-xs font-black uppercase tracking-widest text-white transition hover:bg-brand-blue"
              >
                Mi cuenta
              </Link>
              <form action={signOut} className="mt-2">
                <button
                  type="submit"
                  className="w-full rounded-full border border-brand-line px-5 py-3 text-center text-xs font-black uppercase tracking-widest text-brand-muted transition hover:border-brand-accent hover:text-brand-blue"
                >
                  Cerrar sesión
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setIsOpen(false)}
                className="mt-3 block rounded-full bg-brand-navy px-5 py-3 text-center text-xs font-black uppercase tracking-widest text-white transition hover:bg-brand-blue"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                onClick={() => setIsOpen(false)}
                className="mt-2 block rounded-full border border-brand-line px-5 py-3 text-center text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-accent hover:text-brand-blue"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </nav>
      ) : null}
    </div>
  );
}
