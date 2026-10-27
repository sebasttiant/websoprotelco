import Link from "next/link";
import { Eye, FileText } from "lucide-react";

import { ProductImagePlaceholder } from "@/components/catalog/product-image-placeholder";
import { TaxIncludedNote } from "@/components/catalog/tax-included-note";
import { Badge } from "@/components/ui/badge";
import { RevealImage } from "@/components/ui/reveal-image";
import type { ProductSummary } from "@/domains/catalog";
import { getDiscountPercent, getEffectivePriceCents, getSafeCatalogImageUrl } from "@/domains/catalog/schemas";

interface ProductCardProps {
  product: ProductSummary;
}

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export function ProductCard({ product }: ProductCardProps) {
  const imageUrl = getSafeCatalogImageUrl(product.imageUrl);
  const discountPercent = getDiscountPercent(product);
  const effectivePriceCents = getEffectivePriceCents(product);

  return (
    <article className="group min-w-0 overflow-hidden rounded-2xl border border-brand-blue/25 bg-white p-3 shadow-sm shadow-blue-950/5 transition hover:-translate-y-0.5 hover:border-brand-blue hover:shadow-md hover:shadow-blue-950/10 sm:p-4">
      <Link
        href={`/producto/${product.slug}`}
        className="relative grid aspect-square place-items-center overflow-hidden rounded-2xl bg-brand-ice"
      >
        <Badge className="absolute left-3 top-3 z-10">{product.categoryName}</Badge>
        <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1.5">
          {discountPercent !== null ? (
            <span className="inline-flex items-center rounded-full bg-red-600 px-3 py-1 text-xs font-black uppercase tracking-widest text-white shadow-sm">
              -{discountPercent}%
            </span>
          ) : null}
          {product.isFeatured ? (
            <span className="inline-flex items-center rounded-full bg-brand-navy px-3 py-1 text-xs font-black uppercase tracking-widest text-brand-accent-soft shadow-sm">
              Top
            </span>
          ) : null}
        </div>
        {imageUrl ? (
          <RevealImage
            src={imageUrl}
            alt={product.name}
            sizes="(min-width: 1280px) 20vw, (min-width: 640px) 40vw, 90vw"
            className="p-4 transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
          />
        ) : (
          <ProductImagePlaceholder label={product.name} />
        )}
      </Link>

      <div className="min-w-0 space-y-3 p-2 pt-4 sm:p-3 sm:pt-5">
        <div className="flex items-center justify-between gap-3">
          <Badge variant={product.inStock ? "success" : "warning"}>{product.inStock ? "En stock" : "Consultar"}</Badge>
          <span className="truncate text-xs font-black uppercase tracking-widest text-brand-muted">{product.sku}</span>
        </div>

        <div className="min-w-0">
          <Link href={`/producto/${product.slug}`}>
            <h3 className="line-clamp-2 min-h-11 text-base font-black leading-snug text-brand-navy transition hover:text-brand-blue sm:text-lg">
              {product.name}
            </h3>
          </Link>
          <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-brand-muted">
            {product.description || "Producto profesional para proyectos de conectividad."}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-line pt-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="text-lg font-black text-brand-navy sm:text-xl">
                {formatCurrency(effectivePriceCents, product.currency)}
              </p>
              {discountPercent !== null ? (
                <s className="text-sm font-bold text-brand-muted">{formatCurrency(product.priceCents, product.currency)}</s>
              ) : null}
            </div>
            <TaxIncludedNote className="mt-1" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/contacto?producto=${encodeURIComponent(product.slug)}`} className="inline-flex items-center gap-2 rounded-full border border-brand-blue px-4 py-2 text-xs font-black uppercase tracking-widest text-brand-blue transition hover:bg-brand-ice">
              <FileText aria-hidden="true" className="h-4 w-4" />
              Cotizar
            </Link>
            <Link href={`/producto/${product.slug}`} className="inline-flex items-center gap-2 rounded-full bg-brand-blue px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-brand-primary">
              <Eye aria-hidden="true" className="h-4 w-4" />
              Ver
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
