import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { WhatsAppCta } from "@/components/catalog/whatsapp-cta";
import { ProductCard } from "@/components/catalog/product-card";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { getProductBySlug, getProducts } from "@/domains/catalog";
import { getSiteSettings } from "@/domains/settings";

export const dynamic = "force-dynamic";

const RELATED_LIMIT = 4;

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: "Producto no encontrado | SOPROTELCO" };
  }

  return {
    title: `${product.name} | SOPROTELCO`,
    description: product.description,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  // The catalog has no "related" query, so the same-category listing is reused and the product
  // being viewed is filtered out of its own recommendations.
  const [settings, categoryProducts] = await Promise.all([
    getSiteSettings(),
    getProducts({ categorySlug: product.categorySlug }),
  ]);
  const related = categoryProducts.filter((item) => item.slug !== product.slug).slice(0, RELATED_LIMIT);

  return (
    <main className="min-h-screen bg-brand-ice">
      <Header />
      <Container className="py-12">
        <nav className="mb-8 text-sm font-bold text-brand-muted">
          <Link href="/" className="hover:text-brand-blue">Inicio</Link>
          <span className="mx-2">/</span>
          <Link href="/productos" className="hover:text-brand-blue">Productos</Link>
          <span className="mx-2">/</span>
          <span className="text-brand-navy">{product.name}</span>
        </nav>

        <section className="grid gap-10 rounded-[40px] bg-white p-6 shadow-2xl shadow-blue-950/5 lg:grid-cols-2 lg:p-10">
          <div className="grid aspect-square place-items-center rounded-[32px] bg-brand-ice">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain p-10" />
            ) : (
              <div className="text-center text-brand-blue/25">
                <div className="mx-auto mb-4 grid h-28 w-28 place-items-center rounded-3xl border-2 border-current text-5xl font-black">SP</div>
                <p className="text-xs font-black uppercase tracking-widest">Sin imagen</p>
              </div>
            )}
          </div>

          <div className="flex flex-col justify-center space-y-7">
            <div className="flex flex-wrap gap-3">
              <Badge>{product.categoryName}</Badge>
              <Badge variant="success">{product.inStock ? "En stock" : "Consultar disponibilidad"}</Badge>
            </div>
            <div>
              <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">SKU {product.sku}</p>
              <h1 className="text-4xl font-black leading-tight tracking-tight text-brand-navy md:text-5xl">{product.name}</h1>
            </div>
            <p className="text-lg font-medium leading-8 text-brand-muted">{product.description || "Producto profesional para redes, fibra óptica y proyectos de conectividad empresarial."}</p>
            <p className="text-4xl font-black text-brand-navy">{formatCurrency(product.priceCents, product.currency)}</p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link href="/contacto" className="rounded-full bg-brand-blue px-8 py-4 text-center text-sm font-black uppercase tracking-widest text-white shadow-glow transition hover:bg-brand-primary">
                Solicitar cotización
              </Link>
              <WhatsAppCta
                whatsappNumber={settings.whatsappNumber}
                productName={product.name}
                sku={product.sku}
              />
            </div>
            <Link href="/productos" className="text-sm font-bold text-brand-blue hover:text-brand-primary">
              ← Volver al catálogo
            </Link>
          </div>
        </section>

        {related.length > 0 ? (
          <section aria-label="Productos relacionados" className="mt-16">
            <h2 className="text-3xl font-black text-brand-navy">Productos relacionados</h2>
            <p className="mt-2 text-sm font-medium text-brand-muted">
              Otros equipos de la categoría {product.categoryName}.
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        ) : null}
      </Container>
      <Footer />
    </main>
  );
}
