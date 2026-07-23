import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/admin/status-badge";
import { addLeadNote, assignLead, getLead, getLeadNotes } from "@/domains/leads";
import { formatDateTime, leadSourceLabel, leadStatusLabel } from "@/lib/presentation";
import { isUuid } from "@/lib/uuid";
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

  // Guard the uuid before it reaches the repository so a malformed id renders a clean
  // not-found instead of crashing the page with a Postgres uuid syntax error.
  if (!isUuid(id)) {
    notFound();
  }

  const [lead, notes] = await Promise.all([getLead(id), getLeadNotes(id)]);

  if (!lead) {
    notFound();
  }

  const inputClass = "rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900";

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/leads" className="text-sm font-bold text-brand-blue">
        ← Volver a clientes potenciales
      </Link>

      <div>
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Detalle del cliente potencial</p>
        <h1 className="text-3xl font-black text-slate-950">{lead.name}</h1>
      </div>

      <div className="grid gap-2 rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5">
        <p>
          <span className="font-black text-slate-700">Correo:</span> {lead.email}
        </p>
        <p>
          <span className="font-black text-slate-700">Teléfono:</span> {lead.phone ?? "—"}
        </p>
        <p>
          <span className="font-black text-slate-700">Asunto:</span> {lead.subject ?? "—"}
        </p>
        <p>
          <span className="font-black text-slate-700">Mensaje:</span> {lead.message}
        </p>
        <p>
          <span className="font-black text-slate-700">Origen:</span> {leadSourceLabel(lead.source)}
        </p>
        <p>
          <span className="font-black text-slate-700">Estado:</span> <StatusBadge status={lead.status} label={leadStatusLabel(lead.status)} />
        </p>
        <p>
          <span className="font-black text-slate-700">Asignado a:</span> {lead.assignedTo ?? "Sin asignar"}
        </p>
      </div>

      <form action={assignLead as unknown as FormAction} className="grid gap-4 rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5">
        <input type="hidden" name="id" value={lead.id} />
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Asignar a (ID de usuario)
          <input name="assignedTo" defaultValue={lead.assignedTo ?? ""} className={inputClass} />
        </label>
        <button type="submit" className="rounded-full bg-brand-blue px-5 py-3 text-sm font-black text-white">
          Guardar asignación
        </button>
      </form>

      <div className="space-y-4 rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5">
        <h2 className="text-xl font-black text-slate-950">Notas</h2>
        <ul className="space-y-3">
          {notes.length > 0 ? (
            notes.map((note) => (
              <li key={note.id} className="rounded-2xl border border-slate-200 p-4">
                <p className="text-slate-700">{note.note}</p>
                <p className="text-xs font-bold text-slate-500">{formatDateTime(note.createdAt)}</p>
              </li>
            ))
          ) : (
            <li className="text-sm font-medium text-slate-500">Aún no hay notas.</li>
          )}
        </ul>
        <form action={addLeadNote as unknown as FormAction} className="grid gap-4">
          <input type="hidden" name="leadId" value={lead.id} />
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Agregar nota
            <textarea name="note" required rows={3} className={inputClass} />
          </label>
          <button type="submit" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white">
            Guardar nota
          </button>
        </form>
      </div>
    </section>
  );
}
