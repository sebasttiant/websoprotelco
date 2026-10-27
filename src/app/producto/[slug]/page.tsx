import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { CartProductCard } from "@/components/cart/cart-product-card";
import { ProductImagePlaceholder } from "@/components/catalog/product-image-placeholder";
import { TaxIncludedNote } from "@/components/catalog/tax-included-note";
import { WhatsAppCta } from "@/components/catalog/whatsapp-cta";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { RevealImage } from "@/components/ui/reveal-image";
import { getProductBySlug, getProducts } from "@/domains/catalog";
import { getDiscountPercent, getEffectivePriceCents, getSafeCatalogImageUrl } from "@/domains/catalog/schemas";
import { getDocuments, isSafeDocumentHref } from "@/domains/documents";
import { getSiteSettings } from "@/domains/settings";
import { buildProductJsonLd } from "@/lib/product-json-ld";
import { publicSiteUrl } from "@/lib/site-url";

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
      // Without a photo the share card falls back to the brand card; a page-level
      // openGraph replaces the root one, so the fallback must be named here.
      images: [{ url: imageUrl ?? "/opengraph-image", alt: product.name }],
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
  const [settings, categoryProducts, siteUrl, productDocuments] = await Promise.all([
    getSiteSettings(),
    getProducts({ categorySlug: product.categorySlug, limit: RELATED_LIMIT + 1 }),
    publicSiteUrl(),
    getDocuments({ productId: product.id }).catch(() => ({ documents: [], total: 0, page: 1, pageSize: 0 })),
  ]);
  const jsonLd = buildProductJsonLd(product, siteUrl);
  const related = categoryProducts.filter((item) => item.slug !== product.slug).slice(0, RELATED_LIMIT);
  const imageUrl = getSafeCatalogImageUrl(product.imageUrl);
  const discountPercent = getDiscountPercent(product);
  const effectivePriceCents = getEffectivePriceCents(product);
  const linkedDocuments = productDocuments.documents.filter((doc) => isSafeDocumentHref(doc.filePath));
  const datasheet = linkedDocuments.find((doc) => doc.category === "datasheet") ?? linkedDocuments[0] ?? null;

  return (
    <main className="min-h-screen bg-brand-ice">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
            <div>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <p className="text-2xl font-black tracking-tight text-brand-navy sm:text-3xl">
                  {formatCurrency(effectivePriceCents, product.currency)}
                </p>
                {discountPercent !== null ? (
                  <s className="text-lg font-bold text-brand-muted">{formatCurrency(product.priceCents, product.currency)}</s>
                ) : null}
              </div>
              <TaxIncludedNote className="mt-2" />
            </div>
            {product.inStock ? (
              <div className="flex flex-wrap items-center gap-3">
                <AddToCartButton id={product.id} slug={product.slug} name={product.name} priceCents={effectivePriceCents} currency="COP" />
                {datasheet ? (
                  <a
                    href={datasheet.filePath}
                    download={datasheet.fileName}
                    className="inline-flex items-center justify-center rounded-full border border-brand-blue px-6 py-3 text-xs font-black uppercase tracking-widest text-brand-blue transition hover:bg-brand-ice"
                  >
                    Descargar ficha técnica
                  </a>
                ) : null}
              </div>
            ) : datasheet ? (
              <a
                href={datasheet.filePath}
                download={datasheet.fileName}
                className="inline-flex w-fit items-center justify-center rounded-full border border-brand-blue px-6 py-3 text-xs font-black uppercase tracking-widest text-brand-blue transition hover:bg-brand-ice"
              >
                Descargar ficha técnica
              </a>
            ) : null}
            {linkedDocuments.length > 1 ? (
              <ul className="space-y-2 rounded-2xl border border-brand-line bg-brand-ice/60 p-4">
                <li className="text-[0.65rem] font-black uppercase tracking-widest text-brand-muted">Documentos del producto</li>
                {linkedDocuments.map((doc) => (
                  <li key={doc.id}>
                    <a href={doc.filePath} download={doc.fileName} className="text-sm font-bold text-brand-blue hover:underline">
                      {doc.title}
                    </a>
                  </li>
                ))}
              </ul>
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
