"use client";

import { Search } from "lucide-react";

export function HeaderSearch({ tone = "light" }: { tone?: "light" | "dark" }) {
  const dark = tone === "dark";

  return (
    <form action="/productos" method="get" role="search" className="hidden items-center lg:flex">
      <label htmlFor="header-search" className="sr-only">
        Buscar productos
      </label>
      <div
        className={`flex items-center rounded-xl pl-3 pr-1 focus-within:ring-2 focus-within:ring-brand-accent/40 ${
          dark ? "border border-white/20 bg-white/10" : "border border-brand-blue/30 bg-white"
        }`}
      >
        <input
          id="header-search"
          type="search"
          name="q"
          defaultValue=""
          placeholder="Buscar productos..."
          autoComplete="off"
          suppressHydrationWarning
          className={`w-40 bg-transparent py-2 text-sm font-medium outline-none ${
            dark
              ? "text-white placeholder:text-white/50"
              : "text-brand-navy placeholder:text-brand-muted"
          }`}
        />
        <button
          type="submit"
          aria-label="Buscar"
          className={`grid h-8 w-8 place-items-center rounded-lg transition ${
            dark
              ? "bg-brand-blue text-white hover:bg-brand-primary"
              : "bg-brand-blue text-white hover:bg-brand-primary"
          }`}
        >
          <Search aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
