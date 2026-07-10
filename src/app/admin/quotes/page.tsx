import { updateQuoteStatus } from "@/app/admin/actions";
import { QUOTE_STATUSES, type QuoteStatus } from "@/app/admin/quote-status";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { query } from "@/server/db/pool";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

interface QuotesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface QuoteRow {
  id: string;
  reference: string;
  status: QuoteStatus;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  company_name: string | null;
  created_at: string;
  item_count: string;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isQuoteStatus(value: string): value is QuoteStatus {
  return QUOTE_STATUSES.includes(value as QuoteStatus);
}

async function getQuotes(status: string): Promise<QuoteRow[]> {
  const values: unknown[] = [];
  const where = isQuoteStatus(status) ? "WHERE qr.status = $1" : "";
  if (where) values.push(status);

  return query<QuoteRow>(
    `SELECT qr.id, qr.reference, qr.status, qr.contact_name, qr.contact_email, qr.contact_phone, qr.company_name, qr.created_at,
            count(qri.id) AS item_count
     FROM quote_requests qr
     LEFT JOIN quote_request_items qri ON qri.quote_request_id = qr.id
     ${where}
     GROUP BY qr.id
     ORDER BY qr.created_at DESC`,
    values,
  );
}

export default async function AdminQuotesPage({ searchParams }: QuotesPageProps) {
  const params = await searchParams;
  const status = firstParam(params.status).trim();
  const rows = await getQuotes(status);

  const columns: DataTableColumn<QuoteRow>[] = [
    { key: "reference", header: "Reference", render: (row) => <div><p className="font-black text-slate-950">{row.reference}</p><p className="text-xs font-bold text-slate-500">{new Date(row.created_at).toLocaleDateString("es-CO")}</p></div> },
    { key: "contact", header: "Contact", render: (row) => <div><p className="font-bold text-slate-900">{row.contact_name}</p><p>{row.contact_email}</p><p>{row.contact_phone ?? ""}</p></div> },
    { key: "company", header: "Company", render: (row) => row.company_name ?? "—" },
    { key: "items", header: "Items", render: (row) => row.item_count },
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
