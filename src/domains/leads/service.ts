import * as repository from "./repository";
import type { LeadNoteRow, LeadRow } from "./repository";
import type {
  LeadAssignInput,
  LeadCreateInput,
  LeadNote,
  LeadNoteInput,
  LeadStatusUpdateInput,
  LeadSummary,
} from "./schemas";

function mapLeadSummary(row: LeadRow): LeadSummary {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    subject: row.subject,
    message: row.message,
    source: row.source,
    status: row.status,
    assignedTo: row.assigned_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLeadNote(row: LeadNoteRow): LeadNote {
  return {
    id: row.id,
    leadId: row.lead_id,
    userId: row.user_id,
    note: row.note,
    createdAt: row.created_at,
  };
}

export async function createLead(input: LeadCreateInput, source = "contact_form"): Promise<void> {
  await repository.createLead(input, source);
}

export async function getLeads(status?: string): Promise<LeadSummary[]> {
  const rows = await repository.findAllLeads(status);
  return rows.map(mapLeadSummary);
}

export async function getLead(id: string): Promise<LeadSummary | null> {
  const row = await repository.findLeadById(id);
  return row ? mapLeadSummary(row) : null;
}

export async function updateLeadStatus(input: LeadStatusUpdateInput): Promise<void> {
  await repository.updateLeadStatus(input.id, input.status);
}

export async function assignLead(input: LeadAssignInput): Promise<void> {
  await repository.assignLead(input.id, input.assignedTo);
}

export async function addLeadNote(input: LeadNoteInput, userId: string | null): Promise<void> {
  await repository.addLeadNote(input.leadId, userId, input.note);
}

export async function getLeadNotes(leadId: string): Promise<LeadNote[]> {
  const rows = await repository.findNotesByLeadId(leadId);
  return rows.map(mapLeadNote);
}
