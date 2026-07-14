import * as repository from "./repository";
import type { ProductStockRow, StockMovementRow } from "./repository";
import { DEFAULT_LOW_STOCK_THRESHOLD, type ProductStock, type StockMovement, type StockMovementInput } from "./schemas";

function mapStockMovement(row: StockMovementRow): StockMovement {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    movementType: row.movement_type,
    quantity: row.quantity,
    notes: row.notes,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

function mapProductStock(row: ProductStockRow): ProductStock {
  return {
    productId: row.product_id,
    sku: row.sku,
    name: row.name,
    // `current_stock` is a bigint aggregate; node-pg returns it as a string.
    currentStock: Number(row.current_stock),
  };
}

export const MOVEMENT_PAGE_SIZE = 20;

export async function recordMovement(input: StockMovementInput, userId: string | null): Promise<void> {
  await repository.createMovement(input, userId);
}

export async function getCurrentStock(productId: string): Promise<number> {
  return repository.findCurrentStock(productId);
}

export interface MovementHistory {
  movements: StockMovement[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getMovementHistory(productId: string, page = 1): Promise<MovementHistory> {
  const currentPage = Math.max(1, page);
  const offset = (currentPage - 1) * MOVEMENT_PAGE_SIZE;

  const [rows, total] = await Promise.all([
    repository.findMovementsByProduct(productId, MOVEMENT_PAGE_SIZE, offset),
    repository.countMovementsByProduct(productId),
  ]);

  return {
    movements: rows.map(mapStockMovement),
    total,
    page: currentPage,
    pageSize: MOVEMENT_PAGE_SIZE,
  };
}

export async function getLowStockProducts(
  threshold: number = DEFAULT_LOW_STOCK_THRESHOLD,
): Promise<ProductStock[]> {
  const rows = await repository.findLowStockProducts(threshold);
  return rows.map(mapProductStock);
}
