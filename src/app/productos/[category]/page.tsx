import Link from "next/link";
import { redirect } from "next/navigation";

import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { CatalogPagination } from "@/components/catalog/catalog-pagination";
import { CartProductCard } from "@/components/cart/cart-product-card";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Container } from "@/components/ui/container";
import { getCategories, getProductCatalog } from "@/domains/catalog";
import { catalogHref, firstParam, parseMaxPriceCents, parsePage, parseSort } from "@/lib/catalog-query";

export const dynamic = "force-dynamic";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// A malformed percent-escape (e.g. /productos/%E0%A4%A) makes decodeURIComponent throw a
// URIError, which would surface as a 500 instead of a catalog route. An undecodable segment
// cannot match any category, so the request is sent back to the full catalog.
function decodeCategorySlug(category: string): string | null {
  try {
    return decodeURIComponent(category);
  } catch {
    return null;
  }
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ category }, queryParams] = await Promise.all([params, searchParams]);
  const categorySlug = decodeCategorySlug(category);

  if (categorySlug === null) {
    redirect("/productos");
  }

  const search = firstParam(queryParams.q).trim();
  const brand = firstParam(queryParams.brand).trim();
  const maxPrice = firstParam(queryParams.maxPrice).trim();
  const sort = parseSort(firstParam(queryParams.sort));
  const onlyInStock = firstParam(queryParams.stock) === "1";
  const page = parsePage(firstParam(queryParams.page));

  const [categories, catalog] = await Promise.all([
    getCategories(),
    getProductCatalog({
      search,
      categorySlug,
      brand,
      maxPriceCents: parseMaxPriceCents(maxPrice),
      sort,
      inStock: onlyInStock,
      page,
    }),
  ]);
  const categoryName = categories.find((item) => item.slug === categorySlug)?.name ?? categorySlug;
  const brands = catalog.brands;

  return (
    <main className="min-h-screen bg-white">
      <Header />
      <Container className="py-10 sm:py-12">
        <nav aria-label="Ruta de navegación" className="mb-5 text-sm font-bold text-brand-muted">
          <Link href="/" className="hover:text-brand-blue">Inicio</Link>
          <span className="mx-2">/</span>
          <Link href="/productos" className="hover:text-brand-blue">Catálogo</Link>
          <span className="mx-2">/</span>
          <span className="text-brand-navy">{categoryName}</span>
        </nav>
        <h1 className="text-2xl font-black tracking-tight text-brand-navy sm:text-3xl md:text-4xl">{categoryName}</h1>
        <p className="mt-4 text-lg font-medium leading-8 text-brand-muted">
          Explora nuestra selección especializada de {categoryName.toLocaleLowerCase("es-CO")}.
        </p>

        <div className="mt-10 grid min-w-0 gap-8 lg:grid-cols-4">
          <CatalogFilters
            categories={categories}
            brands={brands}
            currentSearch={search}
            currentCategory={categorySlug}
            currentBrand={brand}
            currentMaxPrice={maxPrice}
            currentSort={sort}
            onlyInStock={onlyInStock}
          />
          <section className="min-w-0 lg:col-span-3" aria-label={`Productos en ${categoryName}`}>
            <div className="mb-8 flex items-center gap-4 rounded-3xl border border-brand-line bg-white p-6 shadow-sm shadow-blue-950/5">
              <span className="grid h-11 min-w-11 place-items-center rounded-full bg-brand-ice px-3 text-sm font-black text-brand-blue">{catalog.total.toLocaleString("es-CO")}</span>
              <p className="font-bold text-brand-muted">Productos encontrados en {categoryName}</p>
            </div>

            {catalog.products.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {catalog.products.map((product) => <CartProductCard key={product.id} product={product} />)}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-brand-line bg-white p-10 text-center shadow-inner sm:p-16">
                <h2 className="text-2xl font-black text-brand-navy">No encontramos productos</h2>
                <p className="mx-auto mt-3 max-w-md font-medium leading-7 text-brand-muted">
                  No hay productos activos en esta categoría por ahora.
                </p>
                <Link href="/productos" className="mt-6 inline-block rounded-full bg-brand-blue px-6 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-brand-primary">
                  Volver al catálogo
                </Link>
              </div>
            )}
            <CatalogPagination
              page={catalog.page}
              total={catalog.total}
              pageSize={catalog.pageSize}
              hrefFor={(nextPage) => catalogHref(`/productos/${categorySlug}`, {
                q: search,
                brand,
                maxPrice,
                sort: sort === "relevant" ? "" : sort,
                stock: onlyInStock ? "1" : "",
              }, nextPage)}
            />
          </section>
        </div>
      </Container>
      <Footer />
    </main>
  );
}
