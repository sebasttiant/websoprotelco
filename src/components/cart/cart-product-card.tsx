import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { ProductCard } from "@/components/catalog/product-card";
import type { ProductSummary } from "@/domains/catalog";

interface CartProductCardProps {
  product: ProductSummary;
}

export function CartProductCard({ product }: CartProductCardProps) {
  return (
    <div className="space-y-3">
      <ProductCard product={product} />
      {product.inStock ? (
        <AddToCartButton id={product.id} slug={product.slug} name={product.name} priceCents={product.priceCents} currency="COP" />
      ) : (
        <p className="text-center text-xs font-black uppercase tracking-widest text-brand-muted">No disponible</p>
      )}
    </div>
  );
}
