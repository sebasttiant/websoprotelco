import Link from "next/link";

import { CartProductCard } from "@/components/cart/cart-product-card";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import type { ProductSummary } from "@/domains/catalog";

interface PromoProductsProps {
  products: ProductSummary[];
}

/**
 * Impact band for what the admin marked as Top or put on promotion. It renders
 * nothing at all when no product is promoted, so the home never shows an empty
 * "offers" shell: the section exists only while it has something to sell.
 */
export function PromoProducts({ products }: PromoProductsProps) {
  if (products.length === 0) return null;

  return (
    <section className="bg-brand-navy py-14 sm:py-20" aria-labelledby="promo-products-heading">
      <Container>
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-[0.65rem] font-black uppercase tracking-widest text-brand-accent">
              Ofertas y selección Top
            </p>
            <h2 id="promo-products-heading" className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Promociones y destacados
            </h2>
            <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-brand-accent-soft/90">
              Equipos con precio especial y los más pedidos por nuestros clientes. El descuento ya está aplicado en el precio final.
            </p>
          </div>
          <Link href="/productos" className="text-sm font-black uppercase tracking-widest text-brand-accent hover:underline">
            Ver todo el catálogo
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {products.map((product, index) => (
            <Reveal key={product.id} delayMs={Math.min(index, 3) * 70}>
              <CartProductCard product={product} />
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
