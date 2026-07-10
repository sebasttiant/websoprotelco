import { z } from "zod";

// --- Storefront read models ---------------------------------------------

const PRODUCT_SORT_VALUES = ["relevant", "price-low", "price-high"] as const;

export const productSortSchema = z.enum(PRODUCT_SORT_VALUES);

export type ProductSort = z.infer<typeof productSortSchema>;

export const productListFiltersSchema = z.object({
  search: z.string().trim().min(1).optional(),
  categorySlug: z.string().trim().min(1).optional(),
  maxPriceCents: z.number().int().min(0).optional(),
  sort: productSortSchema.optional(),
});

export type ProductListFilters = z.infer<typeof productListFiltersSchema>;

export const productSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  sku: z.string(),
  name: z.string(),
  description: z.string(),
  priceCents: z.number().int(),
  currency: z.string(),
  categoryName: z.string(),
  categorySlug: z.string(),
  brand: z.string(),
  // Stored as a relative path from the local/S3 upload adapter (e.g. "/uploads/x.png"),
  // not a fully-qualified URL, so this stays a plain string rather than z.url().
  imageUrl: z.string().nullable(),
  inStock: z.boolean(),
});

export type ProductSummary = z.infer<typeof productSummarySchema>;

export const productDetailSchema = productSummarySchema.extend({
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProductDetail = z.infer<typeof productDetailSchema>;

export const categorySummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  position: z.number().int(),
  imageUrl: z.string().nullable(),
});

export type CategorySummary = z.infer<typeof categorySummarySchema>;

// --- Admin mutation input --------------------------------------------------

const optionalTextSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().nullable(),
);

export const productAdminInputSchema = z.object({
  id: z.uuid().optional(),
  categoryId: z.uuid({ error: "Category is required." }),
  sku: z.string().trim().min(1, { error: "SKU is required." }).max(80),
  slug: z.string().trim().min(1, { error: "Slug is required." }).max(120),
  name: z.string().trim().min(1, { error: "Name is required." }).max(180),
  description: z.string().trim().default(""),
  priceCents: z.coerce.number().int().min(0),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  imageUrl: optionalTextSchema,
  brand: optionalTextSchema,
  stockQuantity: z.coerce.number().int().min(0),
  isActive: z.coerce.boolean().default(false),
});

export type ProductAdminInput = z.infer<typeof productAdminInputSchema>;

export const categoryAdminInputSchema = z.object({
  id: z.uuid().optional(),
  parentId: z.preprocess((value) => (value === "" ? null : value), z.uuid().nullable()),
  slug: z.string().trim().min(1, { error: "Slug is required." }).max(120),
  name: z.string().trim().min(1, { error: "Name is required." }).max(160),
  imageUrl: optionalTextSchema,
  displayOrder: z.coerce.number().int().min(0),
});

export type CategoryAdminInput = z.infer<typeof categoryAdminInputSchema>;

export const catalogDeleteInputSchema = z.object({ id: z.uuid() });

export type CatalogDeleteInput = z.infer<typeof catalogDeleteInputSchema>;
