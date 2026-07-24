import { Search } from "lucide-react";

// A native GET form: submitting navigates to /productos?q=<term>, which the catalog already
// reads. No client JavaScript is needed, so search works even before hydration.
export function HeaderSearch() {
  return (
    <form action="/productos" method="get" role="search" className="hidden items-center lg:flex">
      <label htmlFor="header-search" className="sr-only">
        Buscar productos
      </label>
      <div className="flex items-center rounded-full border border-brand-line bg-white pl-4 pr-1.5 focus-within:border-brand-accent">
        <input
          id="header-search"
          type="search"
          name="q"
          placeholder="Buscar productos..."
          className="w-44 bg-transparent py-2 text-sm font-medium text-brand-navy outline-none placeholder:text-brand-muted"
        />
        <button
          type="submit"
          aria-label="Buscar"
          className="grid h-8 w-8 place-items-center rounded-full bg-brand-blue text-white transition hover:bg-brand-primary"
        >
          <Search aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
