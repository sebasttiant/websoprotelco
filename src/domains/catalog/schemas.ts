import { z } from "zod";

// --- Storefront read models ---------------------------------------------

const PRODUCT_SORT_VALUES = ["relevant", "price-low", "price-high"] as const;

export const productSortSchema = z.enum(PRODUCT_SORT_VALUES);

export type ProductSort = z.infer<typeof productSortSchema>;

export const CATALOG_PAGE_SIZE = 24;

export const productListFiltersSchema = z.object({
  search: z.string().trim().min(1).optional(),
  categorySlug: z.string().trim().min(1).optional(),
  maxPriceCents: z.number().int().min(0).optional(),
  sort: productSortSchema.optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type ProductListFilters = z.infer<typeof productListFiltersSchema>;

export interface ProductCatalogPage {
  products: ProductSummary[];
  total: number;
  page: number;
  pageSize: number;
  brands: string[];
}

export const productSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  sku: z.string(),
  name: z.string(),
  description: z.string(),
  priceCents: z.number().int(),
  promoPriceCents: z.number().int().positive().nullable(),
  isFeatured: z.boolean(),
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

/** The price the customer actually pays: the promotional price while one is set. */
export function getEffectivePriceCents(product: { priceCents: number; promoPriceCents?: number | null }): number {
  return product.promoPriceCents ?? product.priceCents;
}

/** Whole-percent discount of the promotion, or null when there is none. */
export function getDiscountPercent(product: { priceCents: number; promoPriceCents?: number | null }): number | null {
  const promoPriceCents = product.promoPriceCents ?? null;
  if (promoPriceCents === null || product.priceCents <= 0) return null;
  return Math.round((1 - promoPriceCents / product.priceCents) * 100);
}

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

/**
 * Returns a renderable catalog image only for a canonical local upload path.
 * Storefront rendering deliberately ignores remote-origin configuration: catalog assets are
 * served from controlled VPS paths in this phase.
 */
export function getSafeCatalogImageUrl(value: string | null): string | null {
  return value && isSafeCatalogImagePath(value) ? value : null;
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

// Blank or zero means "no promotion": the admin clears a promotion by emptying the
// field, never by entering a magic value.
const promoPriceCentsSchema = z.preprocess(
  (value) => (value === "" || value === null || value === undefined || value === 0 || value === "0" ? null : value),
  z.coerce.number().int().positive().nullable(),
);

const productAdminObjectSchema = z.object({
  id: z.uuid().optional(),
  categoryId: z.uuid({ error: "Category is required." }),
  sku: z.string().trim().min(1, { error: "SKU is required." }).max(80),
  slug: z.string().trim().min(1, { error: "Slug is required." }).max(120),
  name: z.string().trim().min(1, { error: "Name is required." }).max(180),
  description: z.string().trim().default(""),
  priceCents: z.coerce.number().int().min(0),
  promoPriceCents: promoPriceCentsSchema.default(null),
  isFeatured: z.coerce.boolean().default(false),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  imageUrl: catalogImageUrlSchema,
  brand: optionalTextSchema,
  stockQuantity: z.coerce.number().int().min(0),
  isActive: z.coerce.boolean().default(false),
});

// A promotion that is not cheaper than the list price is a data error, not a
// promotion: reject it here (and again in the DB CHECK) so the admin gets a
// field-level message instead of a silent no-op.
const promoPriceIsBelowListPrice = (input: { priceCents: number; promoPriceCents?: number | null }): boolean =>
  input.promoPriceCents === null || input.promoPriceCents === undefined || input.promoPriceCents < input.priceCents;

const PROMO_PRICE_ERROR = {
  error: "El precio promocional debe ser menor que el precio normal.",
  path: ["promoPriceCents"] as string[],
};

export const productAdminInputSchema = productAdminObjectSchema.refine(promoPriceIsBelowListPrice, PROMO_PRICE_ERROR);

// Zod cannot .partial() a refined schema, so the update path refines AFTER
// partialing: same object, same cross-field check, applied in the other order.
export const productAdminUpdateSchema = productAdminObjectSchema
  .required({ id: true })
  .partial({ imageUrl: true })
  .refine(promoPriceIsBelowListPrice, PROMO_PRICE_ERROR);

export type ProductAdminInput = z.infer<typeof productAdminInputSchema>;

export type ProductAdminUpdateInput = Omit<ProductAdminInput, "imageUrl"> & {
  id: string;
  imageUrl?: ProductAdminInput["imageUrl"];
};

export const categoryAdminInputSchema = z.object({
  id: z.uuid().optional(),
  parentId: z.preprocess((value) => (value === "" ? null : value), z.uuid().nullable()),
  slug: z.string().trim().min(1, { error: "Slug is required." }).max(120),
  name: z.string().trim().min(1, { error: "Name is required." }).max(160),
  imageUrl: catalogImageUrlSchema,
  displayOrder: z.coerce.number().int().min(0),
});

export type CategoryAdminInput = z.infer<typeof categoryAdminInputSchema>;

export type CategoryAdminUpdateInput = Omit<CategoryAdminInput, "imageUrl"> & {
  id: string;
  imageUrl?: CategoryAdminInput["imageUrl"];
};

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
  /** When true, only products with no usable image path. */
  missingImage: z.boolean().optional(),
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
  promoPriceCents: z.number().int().positive().nullable(),
  isFeatured: z.boolean(),
  currency: z.string(),
  stockQuantity: z.number().int(),
  isActive: z.boolean(),
  categoryName: z.string().nullable(),
  imageUrl: z.string().nullable(),
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
  promoPriceCents: z.number().int().positive().nullable(),
  isFeatured: z.boolean(),
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
