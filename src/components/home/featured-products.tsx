import Link from "next/link";

import { ProductCard } from "@/components/catalog/product-card";
import { Container } from "@/components/ui/container";
import type { ProductSummary } from "@/server/db/queries/products";

interface FeaturedProductsProps {
  products: ProductSummary[];
}

export function FeaturedProducts({ products }: FeaturedProductsProps) {
  return (
    <section className="bg-brand-ice py-24">
      <Container>
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-4 text-xs font-black uppercase tracking-widest text-brand-blue">Catálogo destacado</p>
            <h2 className="text-4xl font-black tracking-tight text-brand-navy md:text-5xl">Productos para conectividad</h2>
          </div>
          <Link href="/productos" className="text-sm font-black uppercase tracking-widest text-brand-blue hover:underline">
            Ver todo el catálogo
          </Link>
        </div>

        {products.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="rounded-[40px] border border-dashed border-brand-line bg-white p-12 text-center shadow-inner">
            <h3 className="text-2xl font-black text-brand-navy">The public catalog is ready for products</h3>
            <p className="mx-auto mt-3 max-w-xl text-brand-muted">
              Add active products from the admin/database seed and they will appear here automatically.
            </p>
          </div>
        )}
      </Container>
    </section>
  );
}
