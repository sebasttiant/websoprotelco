// Next resolves this specifier through its own bundled copy, so it needs no entry in
// package.json. It fails the build if a client component ever reaches this module.
// It belongs here rather than in server/db/pool.ts, because the migration scripts import
// the pool directly under tsx, where no bundler rewrites the specifier.
import "server-only";

import type { QueryResultRow } from "pg";

import { query } from "@/server/db/pool";

import type { QuoteListFilters, QuoteStatus } from "./schemas";

export interface CustomerQuoteRow extends QueryResultRow {
  id: string;
  reference: string;
  status: QuoteStatus;
  message: string;
  created_at: string;
}

export interface QuoteRow extends QueryResultRow {
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

export interface QuoteStatusRow extends QueryResultRow {
  status: QuoteStatus;
}

export interface NewQuoteRequest {
  reference: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  message: string;
  // Owner of the request: the session user's id for an authenticated submission, or
  // NULL for an anonymous guest. Ownership is fixed at insert time and never derived
  // from the mutable contact_email afterwards.
  userId: string | null;
}

export async function insertQuoteRequest(input: NewQuoteRequest): Promise<void> {
  await query(
    `INSERT INTO quote_requests (reference, contact_name, contact_email, contact_phone, message, user_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [input.reference, input.contactName, input.contactEmail, input.contactPhone, input.message, input.userId],
  );
}

export async function findQuotes(filters: QuoteListFilters = {}): Promise<QuoteRow[]> {
  const values: unknown[] = [];
  let where = "";

  if (filters.status) {
    values.push(filters.status);
    where = `WHERE qr.status = $${values.length}`;
  }

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

// Reads the most recent quote requests owned by a single user. The caller MUST pass
// the session user's own id, resolved server-side from their session. Ownership is
// bound to the immutable user_id column, so a user can never widen this scope by
// editing their email. Guest quotes (user_id IS NULL) can never match this equality
// predicate, so they never surface in any account history.
export async function findQuotesByUserId(userId: string): Promise<CustomerQuoteRow[]> {
  return query<CustomerQuoteRow>(
    `SELECT id, reference, status, message, created_at
     FROM quote_requests
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 5`,
    [userId],
  );
}

export async function findQuoteStatusById(id: string): Promise<QuoteStatus | null> {
  const rows = await query<QuoteStatusRow>("SELECT status FROM quote_requests WHERE id = $1", [id]);
  return rows[0]?.status ?? null;
}

export async function updateQuoteStatusById(id: string, status: QuoteStatus): Promise<void> {
  await query("UPDATE quote_requests SET status = $2 WHERE id = $1", [id, status]);
}
