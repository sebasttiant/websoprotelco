import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { NewOrderModal } from "@/components/admin/new-order-modal";
import { StatusBadge } from "@/components/admin/status-badge";
import { StatusChangeForm } from "@/components/admin/status-change-form";
import {
  adminDarkBtn,
  adminEyebrow,
  adminFilterBarCompact,
  adminHeaderRow,
  adminInput,
  adminLead,
  adminPage,
  adminSelect,
  adminTitle,
} from "@/components/admin/ui";
import { formatCurrencyCents, formatDate, quoteStatusLabel } from "@/lib/presentation";
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
  const search = firstParam(params.q).trim();

  const rows = await getQuotes({
    kind: "order",
    status: isQuoteStatus(status) ? status : undefined,
    search: search || undefined,
  });

  // Creating an order is a write. Reading the list is not, so a role that may only read still
  // sees the page — without a button that would 403 the moment it was pressed.
  const canCreate = hasPermission(user.role, "quote:write");

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
        <div className="min-w-0 max-w-[12rem]">
          <p className="truncate font-bold text-slate-900">{row.contactName}</p>
          <p className="truncate text-xs text-slate-600">{row.contactEmail}</p>
          <p className="truncate text-xs text-slate-500">{row.contactPhone ?? ""}</p>
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
      header: "Estado",
      render: (row) => (
        <StatusChangeForm
          action={updateQuoteStatus as unknown as FormAction}
          id={row.id}
          currentStatus={row.status}
          options={QUOTE_STATUSES}
          labelFor={quoteStatusLabel}
        />
      ),
    },
  ];

  return (
    <section className={adminPage}>
      <div className={adminHeaderRow}>
        <div className="min-w-0">
          <p className={adminEyebrow}>Flujo comercial</p>
          <h1 className={adminTitle}>Pedidos</h1>
          <p className={adminLead}>Control y seguimiento de órdenes</p>
        </div>
        {canCreate ? <NewOrderModal /> : null}
      </div>
      <form className={adminFilterBarCompact}>
        <input
          name="q"
          defaultValue={search}
          placeholder="Buscar referencia, cliente, email o teléfono"
          autoComplete="off"
          className={adminInput}
        />
        <select name="status" defaultValue={status} className={`${adminSelect} w-full`}>
          <option value="">Todos los estados</option>
          {QUOTE_STATUSES.map((option) => (
            <option key={option} value={option}>
              {quoteStatusLabel(option)}
            </option>
          ))}
        </select>
        <button type="submit" className={adminDarkBtn}>
          Filtrar
        </button>
      </form>
      <DataTable rows={rows} columns={columns} emptyMessage="No hay pedidos aún." />
    </section>
  );
}
