import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { NewOrderModal, type OrderProductOption } from "@/components/admin/new-order-modal";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatCurrencyCents, formatDate, quoteStatusLabel } from "@/lib/presentation";
import { getProducts } from "@/domains/catalog";
import {
  getQuotes,
  isQuoteStatus,
  QUOTE_STATUSES,
  updateQuoteStatus,
  type QuoteSummary,
} from "@/domains/quote-order";
import { hasPermission } from "@/server/auth/rbac";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

interface OrdersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

// Orders and quotes are one table split by `kind`, so this screen reuses the quote permission,
// status machine and mutation rather than growing a parallel set that could drift out of sync.
export default async function AdminOrdersPage({ searchParams }: OrdersPageProps) {
  const user = await requirePermission("quote:read");
  const params = await searchParams;
  const status = firstParam(params.status).trim();

  // getProducts returns ACTIVE products only, matching what the server will accept when the
  // order is written — offering an inactive product here would only produce a rejected order.
  const [rows, products] = await Promise.all([
    getQuotes(isQuoteStatus(status) ? { kind: "order", status } : { kind: "order" }),
    getProducts(),
  ]);

  // Creating an order is a write. Reading the list is not, so a role that may only read still
  // sees the page — without a button that would 403 the moment it was pressed.
  const canCreate = hasPermission(user.role, "quote:write");

  const productOptions: OrderProductOption[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    priceCents: product.priceCents,
    categoryName: product.categoryName,
  }));

  const columns: DataTableColumn<QuoteSummary>[] = [
    {
      key: "reference",
      header: "Referencia",
      render: (row) => (
        <div>
          <p className="font-black text-slate-950">{row.reference}</p>
          <p className="text-xs font-bold text-slate-500">{formatDate(row.createdAt)}</p>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Cliente",
      render: (row) => (
        <div>
          <p className="font-bold text-slate-900">{row.contactName}</p>
          <p>{row.contactEmail}</p>
          <p>{row.contactPhone ?? ""}</p>
        </div>
      ),
    },
    { key: "items", header: "Ítems", render: (row) => row.itemCount },
    {
      key: "total",
      header: "Total",
      // "—" means the total is unknown, not zero: at least one line predates the price
      // snapshot added in migration 0013.
      render: (row) => <span className="font-black text-slate-950">{formatCurrencyCents(row.totalCents)}</span>,
    },
    {
      key: "status",
      header: "Estado",
      render: (row) => <StatusBadge status={row.status} label={quoteStatusLabel(row.status)} />,
    },
    {
      key: "change",
      header: "Cambiar estado",
      render: (row) => (
        <form action={updateQuoteStatus as unknown as FormAction} className="flex gap-2">
          <input type="hidden" name="id" value={row.id} />
          <select name="status" defaultValue={row.status} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold">
            {QUOTE_STATUSES.map((option) => (
              <option key={option} value={option}>
                {quoteStatusLabel(option)}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white">
            Guardar
          </button>
        </form>
      ),
    },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Flujo comercial</p>
          <h1 className="text-3xl font-black text-slate-950">Pedidos</h1>
          <p className="mt-2 text-sm font-medium text-brand-muted">Control y seguimiento de órdenes</p>
        </div>
        {canCreate ? <NewOrderModal products={productOptions} /> : null}
      </div>
      <form className="flex max-w-sm gap-3 rounded-[28px] bg-white p-4 shadow-xl shadow-blue-950/5">
        <select name="status" defaultValue={status} className="min-w-0 flex-1 rounded-full border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
          <option value="">Todos los estados</option>
          {QUOTE_STATUSES.map((option) => (
            <option key={option} value={option}>
              {quoteStatusLabel(option)}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white">
          Filtrar
        </button>
      </form>
      <DataTable rows={rows} columns={columns} emptyMessage="No hay pedidos aún." />
    </section>
  );
}
