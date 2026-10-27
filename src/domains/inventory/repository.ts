import "server-only";

import type { QueryResultRow } from "pg";

import { query, withTransaction } from "@/server/db/pool";

import type { StockMovementInput } from "./schemas";

export class InsufficientStockError extends Error {
  constructor() {
    super("Stock cannot go below zero.");
    this.name = "InsufficientStockError";
  }
}

export interface StockMovementRow extends QueryResultRow {
  id: string;
  product_id: string;
  product_name: string;
  movement_type: string;
  quantity: number;
  notes: string | null;
  user_id: string | null;
  created_at: string;
}

export interface ProductStockRow extends QueryResultRow {
  product_id: string;
  sku: string;
  name: string;
  // node-pg returns bigint (int8) columns as JS strings to avoid silent precision loss,
  // so this aggregate can arrive as either a string or a number depending on the driver.
  current_stock: string | number;
}

export async function createMovement(input: StockMovementInput, userId: string | null): Promise<void> {
  // Ledger row + scalar stock must move together. Catalog admin reads products.stock_quantity;
  // inventory screens used to SUM(stock_movements) alone, so a quick ± that only inserted a
  // movement left the two screens disagreeing. Keep both writes in one transaction.
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO stock_movements (product_id, movement_type, quantity, notes, user_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [input.productId, input.movementType, input.quantity, input.notes ?? null, userId],
    );

    const rows = await client.query<{ stock_quantity: number }>(
      `UPDATE products
       SET stock_quantity = stock_quantity + $2, updated_at = now()
       WHERE id = $1 AND stock_quantity + $2 >= 0
       RETURNING stock_quantity`,
      [input.productId, input.quantity],
    );

    if (!rows[0]) {
      throw new InsufficientStockError();
    }
  });
}

export async function findCurrentStock(productId: string): Promise<number> {
  // Canonical quantity lives on products.stock_quantity; the ledger is the audit trail.
  const rows = await query<{ current_stock: string | number }>(
    "SELECT stock_quantity::bigint AS current_stock FROM products WHERE id = $1",
    [productId],
  );
  return Number(rows[0]?.current_stock ?? 0);
}

export async function findMovementsByProduct(
  productId: string,
  limit: number,
  offset: number,
): Promise<StockMovementRow[]> {
  return query<StockMovementRow>(
    `SELECT m.id, m.product_id, p.name AS product_name, m.movement_type, m.quantity, m.notes, m.user_id, m.created_at
     FROM stock_movements m
     JOIN products p ON p.id = m.product_id
     WHERE m.product_id = $1
     ORDER BY m.created_at DESC
     LIMIT $2 OFFSET $3`,
    [productId, limit, offset],
  );
}

export async function countMovementsByProduct(productId: string): Promise<number> {
  const rows = await query<{ total: number }>(
    "SELECT COUNT(*)::int AS total FROM stock_movements WHERE product_id = $1",
    [productId],
  );
  return rows[0]?.total ?? 0;
}

// `%` and `_` are wildcards to LIKE, and `\` escapes them. A visitor typing "50%" into the
// search box means the literal characters, so without this a single "%" matches every row and
// the search silently stops filtering. Backslash goes first, or it would escape its own
// replacements.
function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

// Global history across every product, as opposed to findMovementsByProduct above. Matches on
// the product name and on the note, which is what the operator can actually recall — "the
// adjustment I made for the damaged reel" is a note, not a product.
function movementSearchClause(search: string): { where: string; values: unknown[] } {
  if (search === "") {
    return { where: "", values: [] };
  }

  const pattern = `%${escapeLikePattern(search)}%`;
  return { where: "WHERE p.name ILIKE $1 OR m.notes ILIKE $1", values: [pattern] };
}

export async function findAllMovements(
  search: string,
  limit: number,
  offset: number,
): Promise<StockMovementRow[]> {
  const { where, values } = movementSearchClause(search);

  return query<StockMovementRow>(
    `SELECT m.id, m.product_id, p.name AS product_name, m.movement_type, m.quantity, m.notes, m.user_id, m.created_at
     FROM stock_movements m
     JOIN products p ON p.id = m.product_id
     ${where}
     ORDER BY m.created_at DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );
}

export async function countAllMovements(search: string): Promise<number> {
  const { where, values } = movementSearchClause(search);

  const rows = await query<{ total: number }>(
    `SELECT COUNT(*)::int AS total
     FROM stock_movements m
     JOIN products p ON p.id = m.product_id
     ${where}`,
    values,
  );

  return rows[0]?.total ?? 0;
}

// Every active product with its current stock — the full stock-management table, as opposed to
// findLowStockProducts which filters by the threshold. Optional name/SKU search. Same bigint
// cast rationale as below: an ::int downcast could overflow and take the whole page down.
function stockSearchClause(search: string): { where: string; values: unknown[] } {
  if (search === "") {
    return { where: "", values: [] };
  }

  // `%` and `_` are LIKE wildcards; escape so a typed "%" filters literally instead of matching
  // everything. Backslash first, or it escapes its own replacements.
  const pattern = `%${search.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  return { where: "AND (p.name ILIKE $1 OR p.sku ILIKE $1)", values: [pattern] };
}

export async function findAllStockLevels(search: string): Promise<ProductStockRow[]> {
  const { where, values } = stockSearchClause(search);

  return query<ProductStockRow>(
    `SELECT p.id AS product_id, p.sku, p.name, p.stock_quantity::bigint AS current_stock
     FROM products p
     WHERE p.is_active = true ${where}
     ORDER BY p.name ASC`,
    values,
  );
}

export async function findLowStockProducts(threshold: number): Promise<ProductStockRow[]> {
  return query<ProductStockRow>(
    `SELECT p.id AS product_id, p.sku, p.name, p.stock_quantity::bigint AS current_stock
     FROM products p
     WHERE p.is_active = true AND p.stock_quantity < $1
     ORDER BY p.stock_quantity ASC, p.name ASC`,
    [threshold],
  );
}
