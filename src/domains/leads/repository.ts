// Next resolves this specifier through its own bundled copy, so it needs no entry in
// package.json. It fails the build if a client component ever reaches this module.
import "server-only";

import type { QueryResultRow } from "pg";

import { query } from "@/server/db/pool";

import type { LeadCreateInput } from "./schemas";

export interface LeadRow extends QueryResultRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  source: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadNoteRow extends QueryResultRow {
  id: string;
  lead_id: string;
  user_id: string | null;
  note: string;
  created_at: string;
}

export async function createLead(input: LeadCreateInput, source: string): Promise<void> {
  await query(
    `INSERT INTO leads (name, email, phone, subject, message, source)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [input.name, input.email, input.phone ?? null, input.subject ?? null, input.message, source],
  );
}

export async function findAllLeads(status?: string): Promise<LeadRow[]> {
  const values: unknown[] = [];
  let where = "";

  if (status) {
    values.push(status);
    where = `WHERE status = $${values.length}`;
  }

  return query<LeadRow>(
    `SELECT id, name, email, phone, subject, message, source, status, assigned_to, created_at, updated_at
     FROM leads
     ${where}
     ORDER BY created_at DESC`,
    values,
  );
}

export async function findLeadById(id: string): Promise<LeadRow | null> {
  const rows = await query<LeadRow>(
    `SELECT id, name, email, phone, subject, message, source, status, assigned_to, created_at, updated_at
     FROM leads
     WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function updateLeadStatus(id: string, status: string): Promise<void> {
  await query("UPDATE leads SET status = $2, updated_at = NOW() WHERE id = $1", [id, status]);
}

export async function assignLead(id: string, assignedTo: string | null): Promise<void> {
  await query("UPDATE leads SET assigned_to = $2, updated_at = NOW() WHERE id = $1", [id, assignedTo]);
}

export async function addLeadNote(leadId: string, userId: string | null, note: string): Promise<void> {
  await query("INSERT INTO lead_notes (lead_id, user_id, note) VALUES ($1, $2, $3)", [leadId, userId, note]);
}

export async function findNotesByLeadId(leadId: string): Promise<LeadNoteRow[]> {
  return query<LeadNoteRow>(
    "SELECT id, lead_id, user_id, note, created_at FROM lead_notes WHERE lead_id = $1 ORDER BY created_at DESC",
    [leadId],
  );
}
