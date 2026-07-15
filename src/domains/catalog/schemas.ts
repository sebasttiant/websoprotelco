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

// Product and category images are always produced by the local storage adapter, which returns
// paths of the shape "/uploads/<YYYY-MM-DD>-<uuid>.<ext>". Anything else — a remote URL, a
// base64 data URI, a traversal attempt, a legacy value — must never reach next/image, which
// would throw at render and crash the edit page. This is the single safe-source contract.
const CATALOG_IMAGE_PATH_PATTERN =
  /^\/uploads\/\d{4}-\d{2}-\d{2}-[0-9a-fA-F-]{36}\.(jpg|png|webp)$/;

export function isSafeCatalogImagePath(path: string): boolean {
  return CATALOG_IMAGE_PATH_PATTERN.test(path);
}

// Validates a submitted image value:
//   - blank/null  → null (an explicit, intentional removal of the image);
//   - a safe adapter path (/uploads/<date>-<uuid>.<ext>) → kept as-is;
//   - anything else (remote URL, base64 data URI, javascript:, traversal, legacy string) →
//     REJECTED with a Spanish validation error.
//
// The previous implementation silently coerced every unsafe value to null. That erased existing
// image references whenever an unrelated field was edited: the form resubmitted the stored legacy
// URL, the schema normalized it to null, and the update repository persisted null — silent data
// loss with no signal to the operator. Rejecting the unsafe submission instead forces an explicit
// decision: replace the image (upload a new one) or intentionally remove it (blank the field).
// The read-side preview safety contract (next/image only ever receives a safe path) is unchanged.
const catalogImageUrlSchema = z
  .preprocess((value) => {
    const candidate = typeof value === "string" ? value.trim() : "";
    return candidate === "" ? null : candidate;
  }, z.string().nullable())
  .refine((value) => value === null || isSafeCatalogImagePath(value), {
    error: "La URL de la imagen no es válida. Subí una imagen o dejá el campo en blanco para quitarla.",
  });

export const productAdminInputSchema = z.object({
  id: z.uuid().optional(),
  categoryId: z.uuid({ error: "Category is required." }),
  sku: z.string().trim().min(1, { error: "SKU is required." }).max(80),
  slug: z.string().trim().min(1, { error: "Slug is required." }).max(120),
  name: z.string().trim().min(1, { error: "Name is required." }).max(180),
  description: z.string().trim().default(""),
  priceCents: z.coerce.number().int().min(0),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  imageUrl: catalogImageUrlSchema,
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
  imageUrl: catalogImageUrlSchema,
  displayOrder: z.coerce.number().int().min(0),
});

export type CategoryAdminInput = z.infer<typeof categoryAdminInputSchema>;

export const catalogDeleteInputSchema = z.object({ id: z.uuid() });

export type CatalogDeleteInput = z.infer<typeof catalogDeleteInputSchema>;

// --- Admin read models -------------------------------------------------------
// Unlike the storefront read models above (which only ever surface active
// products), these expose the full catalog — including inactive products and
// categories — because the admin panel manages everything, not just what a
// customer can currently see.

export const PRODUCT_ADMIN_PAGE_SIZE = 15;

const PRODUCT_ADMIN_MAX_PAGE = 100_000;

// Coerces a raw page value (typically a URL search param string) into a safe,
// positive integer bounded to a sane maximum. Anything non-numeric, negative,
// zero, or absurdly large falls back to page 1 rather than reaching the
// LIMIT/OFFSET SQL fragment unchecked.
export const productAdminPageSchema = z.coerce.number().int().min(1).max(PRODUCT_ADMIN_MAX_PAGE).catch(1);

export const productStatusFilterSchema = z.enum(["active", "inactive"]);

export type ProductStatusFilter = z.infer<typeof productStatusFilterSchema>;

export const productAdminListFiltersSchema = z.object({
  search: z.string().trim().min(1).optional(),
  status: productStatusFilterSchema.optional(),
  page: z.number().int().min(1).optional(),
});

export type ProductAdminListFilters = z.infer<typeof productAdminListFiltersSchema>;

export const productAdminSummarySchema = z.object({
  id: z.uuid(),
  sku: z.string(),
  slug: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
  priceCents: z.number().int(),
  currency: z.string(),
  stockQuantity: z.number().int(),
  isActive: z.boolean(),
  categoryName: z.string().nullable(),
});

export type ProductAdminSummary = z.infer<typeof productAdminSummarySchema>;

export const productAdminListResultSchema = z.object({
  rows: z.array(productAdminSummarySchema),
  total: z.number().int(),
  totalPages: z.number().int(),
  page: z.number().int(),
});

export type ProductAdminListResult = z.infer<typeof productAdminListResultSchema>;

export const productAdminDetailSchema = z.object({
  id: z.uuid(),
  categoryId: z.uuid(),
  sku: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  priceCents: z.number().int(),
  currency: z.string(),
  imageUrl: z.string().nullable(),
  brand: z.string().nullable(),
  stockQuantity: z.number().int(),
  isActive: z.boolean(),
});

export type ProductAdminDetail = z.infer<typeof productAdminDetailSchema>;

export const categoryOptionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

export type CategoryOption = z.infer<typeof categoryOptionSchema>;

export const categoryAdminSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  imageUrl: z.string().nullable(),
  displayOrder: z.number().int(),
  parentName: z.string().nullable(),
});

export type CategoryAdminSummary = z.infer<typeof categoryAdminSummarySchema>;

export const categoryAdminDetailSchema = z.object({
  id: z.uuid(),
  parentId: z.uuid().nullable(),
  slug: z.string(),
  name: z.string(),
  imageUrl: z.string().nullable(),
  displayOrder: z.number().int(),
});

export type CategoryAdminDetail = z.infer<typeof categoryAdminDetailSchema>;
