import { FeaturedProducts } from "@/components/home/featured-products";
import { Hero } from "@/components/home/hero";
import { Support } from "@/components/home/support";
import { Ticker } from "@/components/home/ticker";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { getFeaturedProducts } from "@/domains/catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const featuredProducts = await getFeaturedProducts(6);

  return (
    <main className="min-h-screen bg-brand-ice">
      <Header />
      <Hero />
      <Ticker />
      <FeaturedProducts products={featuredProducts} />
      <Support />
      <Footer />
    </main>
  );
}
