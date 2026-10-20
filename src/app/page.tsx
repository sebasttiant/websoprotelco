import type { Metadata } from "next";

import { CategoryStrip } from "@/components/home/category-strip";
import { FeaturedProducts } from "@/components/home/featured-products";
import { PromoProducts } from "@/components/home/promo-products";
import { FiberFlowPanel } from "@/components/home/fiber-flow-panel";
import { Hero } from "@/components/home/hero";
import { Support } from "@/components/home/support";
import { TrustStrip } from "@/components/home/trust-strip";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { getCategories, getFeaturedProducts, getPromotedProducts } from "@/domains/catalog";
import { getSiteSettings } from "@/domains/settings";
import { publicSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: { absolute: "SOPROTELCO | Equipos de fibra óptica y conectividad" },
  description:
    "Compra y venta de equipos de fibra óptica en Colombia: fusionadoras, cortadoras, conversores, kits y conectores. Asesoría técnica y despachos nacionales.",
  alternates: { canonical: "/" },
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [featuredProducts, promotedProducts, categories, settings, siteUrl] = await Promise.all([
    getFeaturedProducts(6),
    getPromotedProducts(4),
    getCategories(),
    getSiteSettings(),
    publicSiteUrl(),
  ]);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: settings.siteName,
        url: siteUrl,
        email: settings.contactEmail,
        telephone: settings.contactPhone,
        address: { "@type": "PostalAddress", streetAddress: settings.address, addressCountry: "CO" },
        description: settings.siteDescription,
      },
      {
        "@type": "WebSite",
        name: settings.siteName,
        url: siteUrl,
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/productos?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <main className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Header />
      <Hero />
      <TrustStrip />
      <FiberFlowPanel />
      <CategoryStrip categories={categories} />
      <PromoProducts products={promotedProducts} />
      <FeaturedProducts products={featuredProducts} />
      <Support />
      <Footer />
    </main>
  );
}
