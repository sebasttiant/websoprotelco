import type { Metadata } from "next";
import Link from "next/link";

import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { CatalogPagination } from "@/components/catalog/catalog-pagination";
import { CartProductCard } from "@/components/cart/cart-product-card";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Container } from "@/components/ui/container";
import { getCategories, getProductCatalog } from "@/domains/catalog";
import { catalogHref, firstParam, parseMaxPriceCents, parsePage, parseSort } from "@/lib/catalog-query";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Catálogo de equipos de fibra óptica",
  description:
    "Fusionadoras, cortadoras, conversores, kits y conectores de fibra óptica. Filtra por categoría, marca y precio, y pide cotización.",
  alternates: { canonical: "/productos" },
};

interface CatalogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const search = firstParam(params.q).trim();
  const category = firstParam(params.category).trim();
  const brand = firstParam(params.brand).trim();
  const maxPrice = firstParam(params.maxPrice).trim();
  const sort = parseSort(firstParam(params.sort));
  const onlyInStock = firstParam(params.stock) === "1";
  const page = parsePage(firstParam(params.page));

  const [categories, catalog] = await Promise.all([
    getCategories(),
    getProductCatalog({
      search,
      categorySlug: category,
      brand,
      maxPriceCents: parseMaxPriceCents(maxPrice),
      sort,
      inStock: onlyInStock,
      page,
    }),
  ]);

  const query = {
    q: search,
    category,
    brand,
    maxPrice,
    sort: sort === "relevant" ? "" : sort,
    stock: onlyInStock ? "1" : "",
  };

  return (
    <main className="min-h-screen bg-white">
      <Header />
      <Container className="py-10 sm:py-12">
        <nav aria-label="Ruta de navegación" className="mb-5 text-sm font-bold text-brand-muted">
          <Link href="/" className="hover:text-brand-blue">Inicio</Link>
          <span className="mx-2">/</span>
          <span className="text-brand-navy">Catálogo de Productos</span>
        </nav>
        <h1 className="text-balance text-2xl font-black tracking-tight text-brand-navy sm:text-3xl md:text-4xl">
          Nuestros Productos
        </h1>
        <p className="mt-4 max-w-2xl text-lg font-medium leading-8 text-brand-muted">
          Explora equipos, herramientas e insumos para fibra óptica, redes y conectividad empresarial.
        </p>

        <div className="mt-10 grid min-w-0 gap-8 lg:grid-cols-4">
          <CatalogFilters
            categories={categories}
            brands={catalog.brands}
            currentSearch={search}
            currentCategory={category}
            currentBrand={brand}
            currentMaxPrice={maxPrice}
            currentSort={sort}
            onlyInStock={onlyInStock}
          />

          <section className="min-w-0 lg:col-span-3">
            <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-brand-line bg-white p-6 shadow-sm shadow-blue-950/5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="grid h-11 min-w-11 place-items-center rounded-full bg-brand-ice px-3 text-sm font-black text-brand-blue">{catalog.total.toLocaleString("es-CO")}</span>
                <p className="font-bold text-brand-muted">{catalog.total === 1 ? "Producto encontrado" : "Productos encontrados"}</p>
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-brand-muted">Precios en pesos colombianos</p>
            </div>

            {catalog.products.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {catalog.products.map((product) => (
                  <CartProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-brand-line bg-white p-10 text-center shadow-inner sm:p-16">
                <h2 className="text-2xl font-black text-brand-navy">No encontramos productos</h2>
                <p className="mx-auto mt-3 max-w-md font-medium leading-7 text-brand-muted">
                  Prueba con otras palabras, otra categoría o un precio más amplio.
                </p>
              </div>
            )}

            <CatalogPagination
              page={catalog.page}
              total={catalog.total}
              pageSize={catalog.pageSize}
              hrefFor={(nextPage) => catalogHref("/productos", query, nextPage)}
            />
          </section>
        </div>
      </Container>
      <Footer />
    </main>
  );
}
