import Link from "next/link";
import { Eye, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ProductSummary } from "@/domains/catalog";
import { getSafeCatalogImageUrl } from "@/domains/catalog/schemas";

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

  return (
    <article className="group overflow-hidden rounded-[32px] border border-slate-100 bg-white p-4 shadow-xl shadow-blue-950/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/10">
      <Link href={`/producto/${product.slug}`} className="relative grid aspect-square place-items-center overflow-hidden rounded-3xl bg-brand-ice">
        <Badge className="absolute left-4 top-4">{product.categoryName}</Badge>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={product.name} className="h-full w-full object-contain p-6 transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="text-center text-brand-blue/25">
            <div className="mx-auto mb-4 grid h-24 w-24 place-items-center rounded-3xl border-2 border-current text-4xl font-black">SP</div>
            <p className="text-xs font-black uppercase tracking-widest">Sin imagen</p>
          </div>
        )}
      </Link>

      <div className="space-y-4 p-3 pt-5">
        <div className="flex items-center justify-between gap-3">
          <Badge variant={product.inStock ? "success" : "warning"}>{product.inStock ? "En stock" : "Consultar"}</Badge>
          <span className="text-xs font-black uppercase tracking-widest text-slate-400">{product.sku}</span>
        </div>

        <div>
          <Link href={`/producto/${product.slug}`}>
            <h3 className="line-clamp-2 min-h-12 text-lg font-black leading-snug text-brand-navy transition hover:text-brand-blue">{product.name}</h3>
          </Link>
          <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-brand-muted">{product.description || "Producto profesional para proyectos de conectividad."}</p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-xl font-black text-brand-navy">{formatCurrency(product.priceCents, product.currency)}</p>
          <Link href={`/contacto?producto=${encodeURIComponent(product.slug)}`} className="inline-flex items-center gap-2 rounded-full border border-brand-blue px-4 py-2 text-xs font-black uppercase tracking-widest text-brand-blue transition hover:bg-blue-50">
            <FileText aria-hidden="true" className="h-4 w-4" />
            Cotizar
          </Link>
          <Link href={`/producto/${product.slug}`} className="inline-flex items-center gap-2 rounded-full bg-brand-blue px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-700">
            <Eye aria-hidden="true" className="h-4 w-4" />
            Ver
          </Link>
        </div>
      </div>
    </article>
  );
}
