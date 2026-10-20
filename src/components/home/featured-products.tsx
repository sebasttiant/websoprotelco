import Link from "next/link";

import { CartProductCard } from "@/components/cart/cart-product-card";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import type { ProductSummary } from "@/domains/catalog";

interface FeaturedProductsProps {
  products: ProductSummary[];
}

export function FeaturedProducts({ products }: FeaturedProductsProps) {
  return (
    <section className="border-b border-brand-line bg-white py-14 sm:py-16">
      <Container>
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-[0.65rem] font-black uppercase tracking-widest text-brand-blue">Catálogo destacado</p>
            <h2 className="text-2xl font-black tracking-tight text-brand-navy sm:text-3xl">Productos para conectividad</h2>
          </div>
          <Link href="/productos" className="text-sm font-black uppercase tracking-widest text-brand-blue hover:underline">
            Ver todo el catálogo
          </Link>
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {products.map((product, index) => (
              <Reveal key={product.id} delayMs={Math.min(index, 5) * 70}>
                <CartProductCard product={product} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="rounded-[32px] border border-dashed border-brand-line bg-white p-12 text-center shadow-inner">
            <h3 className="text-balance text-2xl font-black text-brand-navy">El catálogo todavía no tiene productos publicados</h3>
            <p className="mx-auto mt-3 max-w-xl text-brand-muted">
              En cuanto haya equipos activos, van a aparecer acá. Mientras tanto puedes pedir una cotización.
            </p>
            <Link
              href="/contacto"
              className="mt-8 inline-block rounded-full bg-brand-blue px-8 py-4 text-sm font-black uppercase tracking-widest text-white transition hover:bg-brand-primary"
            >
              Hablar con un asesor
            </Link>
          </div>
        )}
      </Container>
    </section>
  );
}
