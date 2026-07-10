import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/admin/status-badge";
import { addLeadNote, assignLead, getLead, getLeadNotes } from "@/domains/leads";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminLeadDetailPage({ params }: LeadDetailPageProps) {
  // Both admin and staff hold "leads:read" per the RBAC matrix.
  await requirePermission("leads:read");

  const { id } = await params;
  const [lead, notes] = await Promise.all([getLead(id), getLeadNotes(id)]);

  if (!lead) {
    notFound();
  }

  const inputClass = "rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900";

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/leads" className="text-sm font-bold text-brand-blue">
        ← Back to leads
      </Link>

      <div>
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Lead detail</p>
        <h1 className="text-3xl font-black text-slate-950">{lead.name}</h1>
      </div>

      <div className="grid gap-2 rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5">
        <p>
          <span className="font-black text-slate-700">Email:</span> {lead.email}
        </p>
        <p>
          <span className="font-black text-slate-700">Phone:</span> {lead.phone ?? "—"}
        </p>
        <p>
          <span className="font-black text-slate-700">Subject:</span> {lead.subject ?? "—"}
        </p>
        <p>
          <span className="font-black text-slate-700">Message:</span> {lead.message}
        </p>
        <p>
          <span className="font-black text-slate-700">Source:</span> {lead.source}
        </p>
        <p>
          <span className="font-black text-slate-700">Status:</span> <StatusBadge status={lead.status} />
        </p>
        <p>
          <span className="font-black text-slate-700">Assigned to:</span> {lead.assignedTo ?? "Unassigned"}
        </p>
      </div>

      <form action={assignLead as unknown as FormAction} className="grid gap-4 rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5">
        <input type="hidden" name="id" value={lead.id} />
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Assign to (user id)
          <input name="assignedTo" defaultValue={lead.assignedTo ?? ""} className={inputClass} />
        </label>
        <button type="submit" className="rounded-full bg-brand-blue px-5 py-3 text-sm font-black text-white">
          Save assignment
        </button>
      </form>

      <div className="space-y-4 rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5">
        <h2 className="text-xl font-black text-slate-950">Notes</h2>
        <ul className="space-y-3">
          {notes.length > 0 ? (
            notes.map((note) => (
              <li key={note.id} className="rounded-2xl border border-slate-200 p-4">
                <p className="text-slate-700">{note.note}</p>
                <p className="text-xs font-bold text-slate-500">{new Date(note.createdAt).toLocaleString("es-CO")}</p>
              </li>
            ))
          ) : (
            <li className="text-sm font-medium text-slate-500">No notes yet.</li>
          )}
        </ul>
        <form action={addLeadNote as unknown as FormAction} className="grid gap-4">
          <input type="hidden" name="leadId" value={lead.id} />
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Add note
            <textarea name="note" required rows={3} className={inputClass} />
          </label>
          <button type="submit" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white">
            Save note
          </button>
        </form>
      </div>
    </section>
  );
}
