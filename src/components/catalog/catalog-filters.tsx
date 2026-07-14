"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import type { CategorySummary } from "@/domains/catalog";

interface CatalogFiltersProps {
  categories: CategorySummary[];
  brands: string[];
  currentSearch?: string;
  currentCategory?: string;
  currentBrand?: string;
  currentMaxPrice?: string;
  currentSort?: string;
  onlyInStock?: boolean;
}

function setParam(params: URLSearchParams, key: string, value: string): void {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}

export function CatalogFilters({
  categories,
  brands,
  currentSearch = "",
  currentCategory = "",
  currentBrand = "",
  currentMaxPrice = "",
  currentSort = "relevant",
  onlyInStock = false,
}: CatalogFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentSearch);

  function update(key: string, value: string): void {
    const params = new URLSearchParams(searchParams.toString());
    setParam(params, key, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function submitSearch(): void {
    update("q", search.trim());
  }

  return (
    <aside className="lg:col-span-1">
      <div className="sticky top-24 space-y-8 rounded-[32px] bg-white p-8 shadow-xl shadow-blue-950/5">
        <h2 className="text-xl font-black text-brand-navy">Filtros</h2>

        <div className="space-y-3">
          <label htmlFor="catalog-search" className="block text-xs font-black uppercase tracking-widest text-brand-muted">Búsqueda rápida</label>
          <div className="flex gap-2">
            <input
              id="catalog-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitSearch();
              }}
              placeholder="Fusionadora, fibra..."
              className="min-w-0 flex-1 rounded-2xl border border-brand-line bg-brand-ice px-4 py-3 text-sm font-medium outline-none focus:border-brand-blue"
            />
            <button type="button" onClick={submitSearch} className="rounded-2xl bg-brand-blue px-4 text-xs font-black uppercase tracking-widest text-white">
              Buscar
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <label htmlFor="stock-filter" className="flex cursor-pointer items-center justify-between rounded-2xl bg-blue-50 p-4 text-sm font-black text-brand-navy">
            Solo en stock
            <input
              id="stock-filter"
              type="checkbox"
              checked={onlyInStock}
              onChange={(event) => update("stock", event.target.checked ? "1" : "")}
              className="h-5 w-5 accent-brand-blue"
            />
          </label>
        </div>

        <div className="space-y-3">
          <label htmlFor="category-filter" className="block text-xs font-black uppercase tracking-widest text-brand-muted">Categoría</label>
          <select id="category-filter" value={currentCategory} onChange={(event) => update("category", event.target.value)} className="w-full rounded-2xl border border-brand-line bg-brand-ice px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand-blue">
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>{category.name}</option>
            ))}
          </select>
        </div>

        {brands.length > 0 ? (
          <div className="space-y-3">
            <label htmlFor="brand-filter" className="block text-xs font-black uppercase tracking-widest text-brand-muted">Marca</label>
            <select id="brand-filter" value={currentBrand} onChange={(event) => update("brand", event.target.value)} className="w-full rounded-2xl border border-brand-line bg-brand-ice px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand-blue">
              <option value="">Todas</option>
              {brands.map((brand) => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-3">
          <label htmlFor="price-filter" className="block text-xs font-black uppercase tracking-widest text-brand-muted">Precio máximo</label>
          <input id="price-filter" value={currentMaxPrice} onChange={(event) => update("maxPrice", event.target.value)} inputMode="numeric" placeholder="5000000" className="w-full rounded-2xl border border-brand-line bg-brand-ice px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand-blue" />
        </div>

        <div className="space-y-3">
          <label htmlFor="sort-filter" className="block text-xs font-black uppercase tracking-widest text-brand-muted">Ordenar</label>
          <select id="sort-filter" value={currentSort} onChange={(event) => update("sort", event.target.value)} className="w-full rounded-2xl border border-brand-line bg-brand-ice px-4 py-3 text-sm font-bold text-brand-navy outline-none focus:border-brand-blue">
            <option value="relevant">Más relevantes</option>
            <option value="price-low">Menor precio</option>
            <option value="price-high">Mayor precio</option>
          </select>
        </div>

        <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className="w-full rounded-full border border-brand-line px-5 py-3 text-xs font-black uppercase tracking-widest text-brand-muted transition hover:border-brand-blue hover:text-brand-blue">
          Limpiar filtros
        </button>
      </div>
    </aside>
  );
}
