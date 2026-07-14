"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export interface HeaderNavLink {
  href: string;
  label: string;
}

export function HeaderMobileMenu({ links }: { links: readonly HeaderNavLink[] }) {
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

          {/* The header's login button is hidden below the sm breakpoint, so this is the only
              way into the account on a phone. */}
          <Link
            href="/login"
            onClick={() => setIsOpen(false)}
            className="mt-3 block rounded-full bg-brand-navy px-5 py-3 text-center text-xs font-black uppercase tracking-widest text-white transition hover:bg-brand-blue"
          >
            Iniciar sesión
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
