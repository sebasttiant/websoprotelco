import Link from "next/link";
import { redirect } from "next/navigation";

import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { CartProductCard } from "@/components/cart/cart-product-card";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Container } from "@/components/ui/container";
import { getCategories, getProducts } from "@/domains/catalog";

export const dynamic = "force-dynamic";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
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

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;
  const categorySlug = decodeCategorySlug(category);

  if (categorySlug === null) {
    redirect("/productos");
  }

  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts({ categorySlug }),
  ]);
  const categoryName = categories.find((item) => item.slug === categorySlug)?.name ?? categorySlug;
  const brands = Array.from(new Set(products.map((product) => product.brand))).sort((a, b) => a.localeCompare(b));

  return (
    <main className="min-h-screen bg-brand-ice">
      <Header />
      <section className="bg-white py-12">
        <Container>
          <nav aria-label="Ruta de navegación" className="mb-5 text-sm font-bold text-brand-muted">
            <Link href="/" className="hover:text-brand-blue">Inicio</Link>
            <span className="mx-2">/</span>
            <Link href="/productos" className="hover:text-brand-blue">Catálogo</Link>
            <span className="mx-2">/</span>
            <span className="text-brand-navy">{categoryName}</span>
          </nav>
          <h1 className="text-4xl font-black tracking-tight text-brand-navy md:text-5xl">{categoryName}</h1>
          <p className="mt-4 text-lg font-medium leading-8 text-brand-muted">
            Explora nuestra selección especializada de {categoryName.toLocaleLowerCase("es-CO")}.
          </p>
        </Container>
      </section>

      <Container className="py-12">
        <div className="grid gap-8 lg:grid-cols-4">
          <CatalogFilters categories={categories} brands={brands} currentCategory={categorySlug} />
          <section className="lg:col-span-3" aria-label={`Productos en ${categoryName}`}>
            <div className="mb-8 flex items-center gap-4 rounded-[32px] bg-white p-6 shadow-xl shadow-blue-950/5">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-blue-50 text-sm font-black text-brand-blue">{products.length}</span>
              <p className="font-bold text-brand-muted">Productos encontrados en {categoryName}</p>
            </div>

            {products.length > 0 ? (
              <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
                {products.map((product) => <CartProductCard key={product.id} product={product} />)}
              </div>
            ) : (
              <div className="rounded-[40px] border border-dashed border-brand-line bg-white p-16 text-center shadow-inner">
                <h2 className="text-2xl font-black text-brand-navy">No encontramos productos</h2>
                <p className="mx-auto mt-3 max-w-md font-medium leading-7 text-brand-muted">
                  No hay productos activos en esta categoría por ahora.
                </p>
                <Link href="/productos" className="mt-6 inline-block rounded-full bg-brand-blue px-6 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-brand-primary">
                  Volver al catálogo
                </Link>
              </div>
            )}
          </section>
        </div>
      </Container>
      <Footer />
    </main>
  );
}
