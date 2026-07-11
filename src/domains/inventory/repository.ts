import "server-only";

import type { QueryResultRow } from "pg";

import { query } from "@/server/db/pool";

import type { StockMovementInput } from "./schemas";

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
  await query(
    `INSERT INTO stock_movements (product_id, movement_type, quantity, notes, user_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.productId, input.movementType, input.quantity, input.notes ?? null, userId],
  );
}

export async function findCurrentStock(productId: string): Promise<number> {
  // `quantity` is INTEGER (int4), but Postgres always computes SUM(integer) as bigint.
  // Casting that bigint back down to `::int` throws "integer out of range" the moment a
  // product's cumulative sum crosses the int4 boundary, so we keep it as `::bigint` and
  // coerce it in JS instead. node-pg returns bigint columns as strings, hence Number(...).
  const rows = await query<{ current_stock: string | number }>(
    "SELECT COALESCE(SUM(quantity), 0)::bigint AS current_stock FROM stock_movements WHERE product_id = $1",
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

export async function findLowStockProducts(threshold: number): Promise<ProductStockRow[]> {
  // Same overflow hazard as findCurrentStock: this is a single GROUP BY over ALL active
  // products, so an `::int` downcast on one overflowing product's sum would throw and take
  // down the low-stock query — and the whole /admin/inventory page — for every user.
  return query<ProductStockRow>(
    `SELECT p.id AS product_id, p.sku, p.name, COALESCE(SUM(m.quantity), 0)::bigint AS current_stock
     FROM products p
     LEFT JOIN stock_movements m ON m.product_id = p.id
     WHERE p.is_active = true
     GROUP BY p.id, p.sku, p.name
     HAVING COALESCE(SUM(m.quantity), 0) < $1
     ORDER BY current_stock ASC, p.name ASC`,
    [threshold],
  );
}
