import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  getLeads,
  LEAD_STATUSES,
  updateLeadStatus,
  type LeadSummary,
} from "@/domains/leads";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

interface LeadsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isLeadStatus(value: string): value is (typeof LEAD_STATUSES)[number] {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}

export default async function AdminLeadsPage({ searchParams }: LeadsPageProps) {
  // Both admin and staff hold "leads:read" per the RBAC matrix, so this guard runs
  // before any query is issued.
  await requirePermission("leads:read");

  const params = await searchParams;
  const status = firstParam(params.status).trim();
  const rows = await getLeads(isLeadStatus(status) ? status : undefined);

  const columns: DataTableColumn<LeadSummary>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <div>
          <p className="font-black text-slate-950">{row.name}</p>
          <p className="text-xs font-bold text-slate-500">{new Date(row.createdAt).toLocaleDateString("es-CO")}</p>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (row) => (
        <div>
          <p>{row.email}</p>
          <p>{row.phone ?? ""}</p>
        </div>
      ),
    },
    { key: "subject", header: "Subject", render: (row) => row.subject ?? "—" },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    {
      key: "change",
      header: "Change status",
      render: (row) => (
        <form action={updateLeadStatus as unknown as FormAction} className="flex gap-2">
          <input type="hidden" name="id" value={row.id} />
          <select name="status" defaultValue={row.status} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold">
            {LEAD_STATUSES.map((option) => (
              <option key={option} value={option}>
                {option.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white">
            Save
          </button>
        </form>
      ),
    },
    {
      key: "detail",
      header: "Detail",
      render: (row) => (
        <Link href={`/admin/leads/${row.id}`} className="font-bold text-brand-blue hover:underline">
          View
        </Link>
      ),
    },
  ];

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Contact requests</p>
        <h1 className="text-3xl font-black text-slate-950">Leads</h1>
      </div>
      <nav className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-widest">
        <Link
          href="/admin/leads"
          className={`rounded-full px-4 py-2 ${status === "" ? "bg-slate-950 text-white" : "bg-white text-slate-700"}`}
        >
          All
        </Link>
        {LEAD_STATUSES.map((option) => (
          <Link
            key={option}
            href={`/admin/leads?status=${option}`}
            className={`rounded-full px-4 py-2 ${status === option ? "bg-slate-950 text-white" : "bg-white text-slate-700"}`}
          >
            {option.replaceAll("_", " ")}
          </Link>
        ))}
      </nav>
      <DataTable rows={rows} columns={columns} emptyMessage="No leads found." />
    </section>
  );
}
