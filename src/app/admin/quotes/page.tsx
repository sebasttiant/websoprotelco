import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
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
  // Always scoped to kind "quote". Without it this screen would also list every order, which
  // is precisely the conflation the legacy dashboard shipped.
  const rows = await getQuotes(isQuoteStatus(status) ? { kind: "quote", status } : { kind: "quote" });

  const columns: DataTableColumn<QuoteSummary>[] = [
    { key: "reference", header: "Referencia", render: (row) => <div><p className="font-black text-slate-950">{row.reference}</p><p className="text-xs font-bold text-slate-500">{formatDate(row.createdAt)}</p></div> },
    { key: "contact", header: "Contacto", render: (row) => <div><p className="font-bold text-slate-900">{row.contactName}</p><p>{row.contactEmail}</p><p>{row.contactPhone ?? ""}</p></div> },
    { key: "company", header: "Empresa", render: (row) => row.companyName ?? "—" },
    { key: "items", header: "Ítems", render: (row) => row.itemCount },
    { key: "status", header: "Estado", render: (row) => <StatusBadge status={row.status} label={quoteStatusLabel(row.status)} /> },
    { key: "change", header: "Cambiar estado", render: (row) => <form action={updateQuoteStatus as unknown as FormAction} className="flex gap-2"><input type="hidden" name="id" value={row.id} /><select name="status" defaultValue={row.status} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold">{QUOTE_STATUSES.map((option) => <option key={option} value={option}>{quoteStatusLabel(option)}</option>)}</select><button type="submit" className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white">Guardar</button></form> },
  ];

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Flujo comercial</p>
        <h1 className="text-3xl font-black text-slate-950">Cotizaciones</h1>
      </div>
      <form className="flex max-w-sm gap-3 rounded-[28px] bg-white p-4 shadow-xl shadow-blue-950/5">
        <select name="status" defaultValue={status} className="min-w-0 flex-1 rounded-full border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
          <option value="">Todos los estados</option>
          {QUOTE_STATUSES.map((option) => <option key={option} value={option}>{quoteStatusLabel(option)}</option>)}
        </select>
        <button type="submit" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white">Filtrar</button>
      </form>
      <DataTable rows={rows} columns={columns} emptyMessage="No se encontraron cotizaciones." />
    </section>
  );
}
