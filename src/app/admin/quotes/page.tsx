import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { StatusChangeForm } from "@/components/admin/status-change-form";
import {
  adminDarkBtn,
  adminEyebrow,
  adminFilterBarCompact,
  adminInput,
  adminLead,
  adminPage,
  adminSelect,
  adminTitle,
} from "@/components/admin/ui";
import { formatDate, quoteStatusLabel } from "@/lib/presentation";
import {
  getQuotes,
  isQuoteStatus,
  QUOTE_STATUSES,
  updateQuoteStatus,
  type QuoteSummary,
} from "@/domains/quote-order";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

interface QuotesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function AdminQuotesPage({ searchParams }: QuotesPageProps) {
  await requirePermission("quote:read");
  const params = await searchParams;
  const status = firstParam(params.status).trim();
  const search = firstParam(params.q).trim();
  // Always scoped to kind "quote". Without it this screen would also list every order, which
  // is precisely the conflation the legacy dashboard shipped.
  const rows = await getQuotes({
    kind: "quote",
    status: isQuoteStatus(status) ? status : undefined,
    search: search || undefined,
  });

  const columns: DataTableColumn<QuoteSummary>[] = [
    {
      key: "reference",
      header: "Referencia",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-black text-slate-950">{row.reference}</p>
          <p className="text-xs font-bold text-slate-500">{formatDate(row.createdAt)}</p>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contacto",
      render: (row) => (
        <div className="min-w-0 max-w-[12rem]">
          <p className="truncate font-bold text-slate-900">{row.contactName}</p>
          <p className="truncate text-xs text-slate-600">{row.contactEmail}</p>
          <p className="truncate text-xs text-slate-500">{row.contactPhone ?? ""}</p>
        </div>
      ),
    },
    {
      key: "company",
      header: "Empresa",
      render: (row) => <span className="block max-w-[10rem] truncate">{row.companyName ?? "—"}</span>,
    },
    { key: "items", header: "Ítems", render: (row) => row.itemCount },
    {
      key: "status",
      header: "Estado",
      render: (row) => <StatusBadge status={row.status} label={quoteStatusLabel(row.status)} />,
    },
    {
      key: "change",
      header: "Cambiar",
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
      <div className="min-w-0">
        <p className={adminEyebrow}>Flujo comercial</p>
        <h1 className={adminTitle}>Cotizaciones</h1>
        <p className={adminLead}>Seguimiento de solicitudes comerciales</p>
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
      <DataTable rows={rows} columns={columns} emptyMessage="No se encontraron cotizaciones." />
    </section>
  );
}
