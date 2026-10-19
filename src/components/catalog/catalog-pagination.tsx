import Link from "next/link";

interface CatalogPaginationProps {
  page: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
}

export function CatalogPagination({ page, total, pageSize, hrefFor }: CatalogPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav aria-label="Paginación del catálogo" className="mt-8 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-bold text-brand-muted">
        {from}–{to} de {total.toLocaleString("es-CO")}
      </p>
      <div className="flex gap-3">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className="rounded-full border border-brand-line px-5 py-3 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-blue hover:text-brand-blue">
            Anterior
          </Link>
        ) : (
          <span className="rounded-full border border-brand-line px-5 py-3 text-xs font-black uppercase tracking-widest text-brand-muted/40">Anterior</span>
        )}
        <span className="grid place-items-center px-2 text-sm font-black text-brand-navy">
          {page} / {totalPages}
        </span>
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} className="rounded-full bg-brand-blue px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-brand-primary">
            Siguiente
          </Link>
        ) : (
          <span className="rounded-full bg-brand-line px-5 py-3 text-xs font-black uppercase tracking-widest text-white/70">Siguiente</span>
        )}
      </div>
    </nav>
  );
}
