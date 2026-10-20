import Link from "next/link";

import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import type { CategorySummary } from "@/domains/catalog";

export function CategoryStrip({ categories }: { categories: readonly CategorySummary[] }) {
  if (categories.length === 0) return null;

  return (
    <section className="border-b border-brand-line bg-brand-ice py-14 sm:py-16" aria-labelledby="category-strip-title">
      <Container>
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="mb-2 text-[0.65rem] font-black uppercase tracking-widest text-brand-blue">Líneas de producto</p>
            <h2 id="category-strip-title" className="text-balance text-2xl font-black tracking-tight text-brand-navy sm:text-3xl">
              Encuentra lo que necesita tu proyecto
            </h2>
          </div>
          <Link href="/productos" className="hidden text-sm font-black uppercase tracking-widest text-brand-blue hover:underline sm:inline">
            Ver catálogo
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories.slice(0, 8).map((category, index) => (
            <li key={category.slug}>
              <Reveal delayMs={Math.min(index, 7) * 50}>
                <Link
                  href={`/productos/${category.slug}`}
                  className="group flex h-full items-center gap-4 rounded-2xl border border-brand-blue/25 bg-white px-5 py-4 text-sm font-black text-brand-navy transition hover:border-brand-blue hover:text-brand-blue"
                >
                  <span
                    aria-hidden="true"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-blue/10 text-xs font-black uppercase tracking-widest text-brand-blue transition group-hover:bg-brand-blue group-hover:text-white"
                  >
                    {category.name.slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{category.name}</span>
                  <span aria-hidden="true" className="text-brand-blue transition group-hover:translate-x-0.5">
                    →
                  </span>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
