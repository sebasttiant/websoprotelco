import { z } from "zod";

// --- Movement type -----------------------------------------------------------

export const MOVEMENT_TYPES = ["sale", "purchase", "adjustment", "return"] as const;

export const movementTypeSchema = z.enum(MOVEMENT_TYPES);

export type MovementType = z.infer<typeof movementTypeSchema>;

export function isMovementType(value: string): value is MovementType {
  return (MOVEMENT_TYPES as readonly string[]).includes(value);
}

// --- Product id guard -----------------------------------------------------------
// `product_id` is a UUID column. Any caller that received it as a free-form string
// (e.g. a search param from the URL) must validate it here before it reaches a query,
// otherwise Postgres throws "invalid input syntax for type uuid" and crashes the page.

const productIdSchema = z.uuid();

export function isProductId(value: string): boolean {
  return productIdSchema.safeParse(value).success;
}

// --- Low stock threshold ------------------------------------------------------
// The spec's per-product minimum stock column does not exist on `products`, so the
// threshold is a global, admin-adjustable parameter instead. See the "Implementation
// Notes" section of specs/inventory/spec.md for the full rationale.

export const DEFAULT_LOW_STOCK_THRESHOLD = 10;

// --- Read models ---------------------------------------------------------------

export const stockMovementSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  productName: z.string(),
  movementType: z.string(),
  quantity: z.number().int(),
  notes: z.string().nullable(),
  userId: z.string().nullable(),
  createdAt: z.string(),
});

export type StockMovement = z.infer<typeof stockMovementSchema>;

export const productStockSchema = z.object({
  productId: z.uuid(),
  sku: z.string(),
  name: z.string(),
  currentStock: z.number().int(),
});

export type ProductStock = z.infer<typeof productStockSchema>;

// --- Admin mutation input ------------------------------------------------------

export const stockMovementInputSchema = z.object({
  productId: z.uuid(),
  movementType: movementTypeSchema,
  quantity: z.coerce
    .number()
    .int({ error: "Quantity must be a whole number." })
    .min(-1_000_000, { error: "Quantity is out of range." })
    .max(1_000_000, { error: "Quantity is out of range." })
    .refine((value) => value !== 0, { error: "Quantity must not be zero." }),
  notes: z.string().trim().max(500).optional(),
});

export type StockMovementInput = z.infer<typeof stockMovementInputSchema>;
