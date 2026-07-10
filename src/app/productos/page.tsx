import Link from "next/link";

import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { ProductCard } from "@/components/catalog/product-card";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Container } from "@/components/ui/container";
import { getCategories, getProducts, type ProductSort } from "@/domains/catalog";

export const dynamic = "force-dynamic";

interface CatalogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parseMaxPriceCents(value: string): number | undefined {
  const parsed = Number.parseInt(value.replace(/\D/g, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed * 100 : undefined;
}

function parseSort(value: string): ProductSort {
  return value === "price-low" || value === "price-high" ? value : "relevant";
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const search = firstParam(params.q).trim();
  const category = firstParam(params.category).trim();
  const brand = firstParam(params.brand).trim();
  const maxPrice = firstParam(params.maxPrice).trim();
  const sort = parseSort(firstParam(params.sort));
  const onlyInStock = firstParam(params.stock) === "1";

  const [categories, allProducts] = await Promise.all([
    getCategories(),
    getProducts({ search, categorySlug: category, maxPriceCents: parseMaxPriceCents(maxPrice), sort }),
  ]);

  const brands = Array.from(new Set(allProducts.map((product) => product.brand))).sort((a, b) => a.localeCompare(b));
  const products = allProducts.filter((product) => (!brand || product.brand === brand) && (!onlyInStock || product.inStock));

  return (
    <main className="min-h-screen bg-brand-ice">
      <Header />
      <section className="bg-white py-12">
        <Container>
          <nav className="mb-5 text-sm font-bold text-brand-muted">
            <Link href="/" className="hover:text-brand-blue">Inicio</Link>
            <span className="mx-2">/</span>
            <span className="text-brand-navy">Catálogo de Productos</span>
          </nav>
          <h1 className="text-4xl font-black tracking-tight text-brand-navy md:text-5xl">Nuestros Productos</h1>
          <p className="mt-4 max-w-2xl text-lg font-medium leading-8 text-brand-muted">
            Explora equipos, herramientas e insumos para fibra óptica, redes y conectividad empresarial.
          </p>
        </Container>
      </section>

      <Container className="py-12">
        <div className="grid gap-8 lg:grid-cols-4">
          <CatalogFilters
            categories={categories}
            brands={brands}
            currentSearch={search}
            currentCategory={category}
            currentBrand={brand}
            currentMaxPrice={maxPrice}
            currentSort={sort}
            onlyInStock={onlyInStock}
          />

          <section className="lg:col-span-3">
            <div className="mb-8 flex flex-col gap-4 rounded-[32px] bg-white p-6 shadow-xl shadow-blue-950/5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-blue-50 text-sm font-black text-brand-blue">{products.length}</span>
                <p className="font-bold text-brand-muted">Productos encontrados</p>
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Datos desde PostgreSQL</p>
            </div>

            {products.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="rounded-[40px] border border-dashed border-brand-line bg-white p-16 text-center shadow-inner">
                <h2 className="text-2xl font-black text-brand-navy">No encontramos productos</h2>
                <p className="mx-auto mt-3 max-w-md font-medium leading-7 text-brand-muted">
                  Intenta ajustar los filtros o cargar productos activos en la base de datos.
                </p>
              </div>
            )}
          </section>
        </div>
      </Container>
      <Footer />
    </main>
  );
}
