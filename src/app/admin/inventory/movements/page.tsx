import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { getAllMovements, MOVEMENT_PAGE_SIZE, type StockMovement } from "@/domains/inventory";
import { formatDateTime, movementTypeLabel } from "@/lib/presentation";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

interface MovementsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

// A page number arrives as free-form text from the URL. Anything that is not a positive integer
// falls back to page 1 rather than reaching the query, where it would become OFFSET NaN.
function parsePage(raw: string): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function AdminMovementsPage({ searchParams }: MovementsPageProps) {
  await requirePermission("inventory:read");

  const params = await searchParams;
  const search = firstParam(params.search).trim();
  const page = parsePage(firstParam(params.page));

  const history = await getAllMovements(search, page);
  const totalPages = Math.max(1, Math.ceil(history.total / MOVEMENT_PAGE_SIZE));

  function pageHref(target: number): string {
    const query = new URLSearchParams();
    if (search !== "") query.set("search", search);
    query.set("page", String(target));
    return `/admin/inventory/movements?${query.toString()}`;
  }

  const columns: DataTableColumn<StockMovement>[] = [
    {
      key: "createdAt",
      header: "Fecha y hora",
      render: (row) => <span className="font-bold text-slate-900">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: "product",
      header: "Producto",
      render: (row) => (
        <Link href={`/admin/inventory?productId=${row.productId}`} className="font-black text-brand-blue hover:underline">
          {row.productName}
        </Link>
      ),
    },
    { key: "type", header: "Tipo", render: (row) => movementTypeLabel(row.movementType) },
    {
      key: "quantity",
      header: "Cantidad",
      // Sign carries the meaning here — an entry versus a withdrawal — so it is shown
      // explicitly rather than left for the reader to infer from the movement type.
      render: (row) => (
        <span className={`font-black ${row.quantity < 0 ? "text-red-600" : "text-emerald-600"}`}>
          {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
        </span>
      ),
    },
    { key: "notes", header: "Motivo / descripción", render: (row) => row.notes ?? "—" },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link
            href="/admin/inventory"
            aria-label="Volver a gestión de stock"
            className="mt-1 rounded-full border border-brand-line p-2 text-brand-muted transition hover:border-brand-accent hover:text-brand-blue"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-widest text-brand-blue">Inventario</p>
            <h1 className="text-2xl font-black tracking-tight text-brand-navy sm:text-3xl">Historial de movimientos</h1>
            <p className="mt-2 text-sm font-medium text-brand-muted">
              Registro detallado de entradas, salidas y ajustes
            </p>
          </div>
        </div>

        {/* A GET form, so the search lands in the URL: the result stays shareable, survives a
            reload, and needs no client-side state. */}
        <form className="relative w-full max-w-sm">
          <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <label htmlFor="movement-search" className="sr-only">
            Buscar por producto o motivo
          </label>
          <input
            id="movement-search"
            type="search"
            name="search"
            defaultValue={search}
            placeholder="Buscar por producto o motivo…"
            className="w-full rounded-full border border-brand-line bg-white py-3 pl-11 pr-4 text-sm font-bold text-brand-navy shadow-sm"
          />
        </form>
      </div>

      <DataTable
        rows={history.movements}
        columns={columns}
        emptyMessage={
          search === ""
            ? "No hay movimientos registrados."
            : `Sin movimientos que coincidan con “${search}”.`
        }
      />

      {history.total > MOVEMENT_PAGE_SIZE ? (
        <nav aria-label="Paginación del historial" className="flex items-center justify-between text-sm font-bold text-brand-muted">
          <Link
            href={pageHref(Math.max(1, history.page - 1))}
            aria-label="Página anterior"
            aria-disabled={history.page <= 1}
            className="rounded-full border border-brand-line px-4 py-2 transition hover:border-brand-accent aria-disabled:pointer-events-none aria-disabled:opacity-40"
          >
            Anterior
          </Link>
          <span>
            Página {history.page} de {totalPages} · {history.total} movimientos
          </span>
          <Link
            href={pageHref(Math.min(totalPages, history.page + 1))}
            aria-label="Página siguiente"
            aria-disabled={history.page >= totalPages}
            className="rounded-full border border-brand-line px-4 py-2 transition hover:border-brand-accent aria-disabled:pointer-events-none aria-disabled:opacity-40"
          >
            Siguiente
          </Link>
        </nav>
      ) : null}
    </section>
  );
}
