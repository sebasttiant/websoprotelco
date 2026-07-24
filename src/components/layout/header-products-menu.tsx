import Link from "next/link";
import { ChevronDown } from "lucide-react";

import type { CategorySummary } from "@/domains/catalog";

// "Productos" stays a real link to the full catalog; the category dropdown is revealed on
// hover and keyboard focus with CSS only, so no client JavaScript is needed.
export function HeaderProductsMenu({ categories }: { categories: readonly CategorySummary[] }) {
  return (
    <div className="group relative">
      <Link
        href="/productos"
        className="inline-flex items-center gap-1 transition-colors hover:text-brand-blue"
      >
        Productos
        <ChevronDown aria-hidden="true" className="h-4 w-4 transition group-hover:rotate-180" />
      </Link>

      {categories.length > 0 ? (
        <div className="invisible absolute left-0 top-full z-50 pt-3 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
          <ul className="min-w-56 rounded-2xl border border-brand-line bg-white p-2 shadow-brand">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/productos/${category.slug}`}
                  className="block rounded-xl px-4 py-2 text-sm font-bold text-brand-navy transition hover:bg-brand-ice hover:text-brand-blue"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
