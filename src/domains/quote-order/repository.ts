// Next resolves this specifier through its own bundled copy, so it needs no entry in
// package.json. It fails the build if a client component ever reaches this module.
// It belongs here rather than in server/db/pool.ts, because the migration scripts import
// the pool directly under tsx, where no bundler rewrites the specifier.
import "server-only";

import type { QueryResultRow } from "pg";

import { query, withTransaction } from "@/server/db/pool";

import type { CartOrderItemInput, QuoteKind, QuoteListFilters, QuoteStatus } from "./schemas";

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
  kind: QuoteKind;
  status: QuoteStatus;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  company_name: string | null;
  created_at: string;
  item_count: string;
  // pg returns bigint/numeric aggregates as strings to avoid a lossy conversion, and NULL
  // when the total cannot be trusted. Both cases are decoded in the service layer.
  total_cents: string | null;
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

export interface NewOrder {
  reference: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  message: string;
  userId: string | null;
  items: readonly CartOrderItemInput[];
}

interface PricedProductRow extends QueryResultRow {
  id: string;
  name: string;
  price_cents: string;
}

interface InsertedOrderRow extends QueryResultRow {
  id: string;
}

export class UnavailableProductError extends Error {
  constructor() {
    super("One or more products are no longer available.");
    this.name = "UnavailableProductError";
  }
}

/**
 * Writes an order and its line items atomically, pricing every line from the PRODUCTS TABLE.
 *
 * The caller passes ids and quantities only. Prices and names are read here, inside the same
 * transaction as the insert, so the snapshot cannot drift from what was charged and a client
 * has no way to state what anything costs.
 *
 * Inactive and unknown products are rejected outright rather than skipped: silently dropping a
 * line would confirm an order the customer never placed, for less than they asked for.
 */
export async function insertOrder(input: NewOrder): Promise<{ id: string; totalCents: number }> {
  return withTransaction(async (client) => {
    const productIds = input.items.map((item) => item.productId);

    const products = await client.query<PricedProductRow>(
      "SELECT id, name, price_cents FROM products WHERE id = ANY($1::uuid[]) AND is_active = true",
      [productIds],
    );

    const pricing = new Map(products.map((row) => [row.id, row]));

    // A short read means at least one id was unknown or inactive. Duplicate ids in the request
    // collapse in the map, so compare against the DISTINCT set rather than the raw length.
    if (pricing.size !== new Set(productIds).size) {
      throw new UnavailableProductError();
    }

    const orderRows = await client.query<InsertedOrderRow>(
      `INSERT INTO quote_requests (reference, kind, contact_name, contact_email, contact_phone, message, user_id)
       VALUES ($1, 'order', $2, $3, $4, $5, $6)
       RETURNING id`,
      [input.reference, input.contactName, input.contactEmail, input.contactPhone, input.message, input.userId],
    );

    const orderId = orderRows[0]?.id;
    if (!orderId) {
      throw new Error("Order insert returned no id.");
    }

    let totalCents = 0;

    for (const item of input.items) {
      // Non-null: the size check above proves every id resolved.
      const product = pricing.get(item.productId)!;
      const unitPriceCents = Number(product.price_cents);

      const lineCents = unitPriceCents * item.quantity;
      totalCents += lineCents;

      // Mirrors the cart's overflow guard. Past this range IEEE-754 rounds silently, and a
      // rounded order total is a wrong invoice. Throwing rolls the whole order back.
      if (!Number.isSafeInteger(lineCents) || !Number.isSafeInteger(totalCents)) {
        throw new Error("Order total is not representable.");
      }

      await client.query(
        `INSERT INTO quote_request_items (quote_request_id, product_id, description, quantity, unit_price_cents, product_name)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, item.productId, product.name, item.quantity, unitPriceCents, product.name],
      );
    }

    return { id: orderId, totalCents };
  });
}

export async function findQuotes(filters: QuoteListFilters = {}): Promise<QuoteRow[]> {
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`qr.status = $${values.length}`);
  }

  // Callers scope by kind so the quotes screen never lists orders and vice versa. Omitting it
  // returns both, which only the dashboard's "everything commercial" counts should ever want.
  if (filters.kind) {
    values.push(filters.kind);
    conditions.push(`qr.kind = $${values.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // The total collapses to NULL as soon as ONE line lacks a price snapshot. SUM() skips NULLs
  // silently, so a request with a $500.000 priced line and an unpriced legacy line would
  // otherwise report $500.000 as if that were the whole thing. A total is either complete or
  // unknown; there is no useful third state.
  return query<QuoteRow>(
    `SELECT qr.id, qr.reference, qr.kind, qr.status, qr.contact_name, qr.contact_email, qr.contact_phone, qr.company_name, qr.created_at,
            count(qri.id) AS item_count,
            CASE
              WHEN bool_or(qri.id IS NOT NULL AND qri.unit_price_cents IS NULL) THEN NULL
              ELSE COALESCE(sum(qri.quantity * qri.unit_price_cents), 0)
            END AS total_cents
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
