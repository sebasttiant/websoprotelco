import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { CartProductCard } from "@/components/cart/cart-product-card";
import { ProductImagePlaceholder } from "@/components/catalog/product-image-placeholder";
import { WhatsAppCta } from "@/components/catalog/whatsapp-cta";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { RevealImage } from "@/components/ui/reveal-image";
import { getProductBySlug, getProducts } from "@/domains/catalog";
import { getDiscountPercent, getEffectivePriceCents, getSafeCatalogImageUrl } from "@/domains/catalog/schemas";
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
    return { title: "Producto no encontrado" };
  }

  const description = product.description.trim().slice(0, 160) || `${product.name} de ${product.categoryName}. Cotiza con SOPROTELCO.`;
  const imageUrl = getSafeCatalogImageUrl(product.imageUrl);

  return {
    title: product.name,
    description,
    alternates: { canonical: `/producto/${product.slug}` },
    openGraph: {
      title: product.name,
      description,
      type: "website",
      url: `/producto/${product.slug}`,
      ...(imageUrl ? { images: [{ url: imageUrl, alt: product.name }] } : {}),
    },
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
    getProducts({ categorySlug: product.categorySlug, limit: RELATED_LIMIT + 1 }),
  ]);
  const related = categoryProducts.filter((item) => item.slug !== product.slug).slice(0, RELATED_LIMIT);
  const imageUrl = getSafeCatalogImageUrl(product.imageUrl);
  const discountPercent = getDiscountPercent(product);
  const effectivePriceCents = getEffectivePriceCents(product);

  return (
    <main className="min-h-screen bg-brand-ice">
      <Header />
      <Container className="py-12">
        <nav aria-label="Ruta de navegación" className="mb-8 text-sm font-bold text-brand-muted">
          <Link href="/" className="hover:text-brand-blue">Inicio</Link>
          <span className="mx-2">/</span>
          <Link href="/productos" className="hover:text-brand-blue">Productos</Link>
          <span className="mx-2">/</span>
          <span className="text-brand-navy">{product.name}</span>
        </nav>

        <section className="grid min-w-0 gap-8 overflow-hidden rounded-3xl border border-brand-blue/25 bg-white p-5 shadow-sm shadow-blue-950/5 sm:p-6 lg:grid-cols-2 lg:gap-10 lg:p-8">
          <div className="relative grid aspect-square min-w-0 place-items-center overflow-hidden rounded-2xl bg-brand-ice">
            {imageUrl ? (
              <RevealImage
                src={imageUrl}
                alt={product.name}
                priority
                sizes="(min-width: 1024px) 40vw, 90vw"
                className="p-6 sm:p-8"
              />
            ) : (
              <ProductImagePlaceholder size="detail" label={product.name} />
            )}
          </div>

          <div className="flex flex-col justify-center space-y-7">
            <div className="flex flex-wrap gap-3">
              <Badge>{product.categoryName}</Badge>
              <Badge variant="success">{product.inStock ? "En stock" : "Consultar disponibilidad"}</Badge>
              {discountPercent !== null ? (
                <span className="inline-flex items-center rounded-full bg-red-600 px-3 py-1 text-xs font-black uppercase tracking-widest text-white">
                  -{discountPercent}%
                </span>
              ) : null}
              {product.isFeatured ? (
                <span className="inline-flex items-center rounded-full bg-brand-navy px-3 py-1 text-xs font-black uppercase tracking-widest text-brand-accent-soft">
                  Top
                </span>
              ) : null}
            </div>
            <div>
              <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">SKU {product.sku}</p>
              <h1 className="text-2xl font-black leading-snug tracking-tight text-brand-navy sm:text-3xl md:text-4xl">
                {product.name}
              </h1>
            </div>
            <p className="text-lg font-medium leading-8 text-brand-muted">{product.description || "Producto profesional para redes, fibra óptica y proyectos de conectividad empresarial."}</p>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <p className="text-2xl font-black tracking-tight text-brand-navy sm:text-3xl">
                {formatCurrency(effectivePriceCents, product.currency)}
              </p>
              {discountPercent !== null ? (
                <s className="text-lg font-bold text-brand-muted">{formatCurrency(product.priceCents, product.currency)}</s>
              ) : null}
            </div>
            {product.inStock ? (
              <div>
                <AddToCartButton id={product.id} slug={product.slug} name={product.name} priceCents={effectivePriceCents} currency="COP" />
              </div>
            ) : null}
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link href={`/contacto?producto=${encodeURIComponent(product.slug)}`} className="rounded-full bg-brand-blue px-8 py-4 text-center text-sm font-black uppercase tracking-widest text-white shadow-glow transition hover:bg-brand-primary">
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
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => (
                <CartProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        ) : null}
      </Container>
      <Footer />
    </main>
  );
}
