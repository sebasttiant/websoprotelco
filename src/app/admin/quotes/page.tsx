import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
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
  const rows = await getQuotes(isQuoteStatus(status) ? { status } : {});

  const columns: DataTableColumn<QuoteSummary>[] = [
    { key: "reference", header: "Reference", render: (row) => <div><p className="font-black text-slate-950">{row.reference}</p><p className="text-xs font-bold text-slate-500">{new Date(row.createdAt).toLocaleDateString("es-CO")}</p></div> },
    { key: "contact", header: "Contact", render: (row) => <div><p className="font-bold text-slate-900">{row.contactName}</p><p>{row.contactEmail}</p><p>{row.contactPhone ?? ""}</p></div> },
    { key: "company", header: "Company", render: (row) => row.companyName ?? "—" },
    { key: "items", header: "Items", render: (row) => row.itemCount },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "change", header: "Change status", render: (row) => <form action={updateQuoteStatus as unknown as FormAction} className="flex gap-2"><input type="hidden" name="id" value={row.id} /><select name="status" defaultValue={row.status} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold">{QUOTE_STATUSES.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</select><button type="submit" className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white">Save</button></form> },
  ];

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Commercial workflow</p>
        <h1 className="text-3xl font-black text-slate-950">Quotes</h1>
      </div>
      <form className="flex max-w-sm gap-3 rounded-[28px] bg-white p-4 shadow-xl shadow-blue-950/5">
        <select name="status" defaultValue={status} className="min-w-0 flex-1 rounded-full border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
          <option value="">All statuses</option>
          {QUOTE_STATUSES.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
        </select>
        <button type="submit" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white">Filter</button>
      </form>
      <DataTable rows={rows} columns={columns} emptyMessage="No quote requests found." />
    </section>
  );
}
