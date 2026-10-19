// Next resolves this specifier through its own bundled copy, so it needs no entry in
// package.json. It fails the build if a client component ever reaches this module.
// It belongs here rather than in server/db/pool.ts, because the migration scripts import
// the pool directly under tsx, where no bundler rewrites the specifier.
import "server-only";

import type { QueryResultRow } from "pg";

import { query } from "@/server/db/pool";

import { PRODUCT_ADMIN_PAGE_SIZE } from "./schemas";
import type {
  CategoryAdminInput,
  CategoryAdminUpdateInput,
  ProductAdminInput,
  ProductAdminUpdateInput,
  ProductAdminListFilters,
  ProductListFilters,
} from "./schemas";

export interface ProductRow extends QueryResultRow {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string;
  price_cents: string;
  currency: string;
  category_name: string | null;
  category_slug: string | null;
  brand: string | null;
  image_url: string | null;
  stock_quantity: number;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryRow extends QueryResultRow {
  id: string;
  slug: string;
  name: string;
  display_order: number;
  image_url: string | null;
}

const PRODUCT_COLUMNS = `p.id, p.slug, p.sku, p.name, p.description, p.price_cents, p.currency, p.brand, p.image_url, p.stock_quantity,
            c.name AS category_name, c.slug AS category_slug`;

export interface ActiveProductFilters extends ProductListFilters {
  brand?: string;
  inStock?: boolean;
  offset?: number;
}

function activeWhere(filters: ActiveProductFilters, includeBrand = true): { where: string[]; values: unknown[] } {
  const where = ["p.is_active = true"];
  const values: unknown[] = [];

  if (filters.search) {
    values.push(`%${filters.search}%`);
    where.push(`(p.name ILIKE $${values.length} OR p.description ILIKE $${values.length} OR p.sku ILIKE $${values.length})`);
  }

  if (filters.categorySlug) {
    values.push(filters.categorySlug);
    where.push(`c.slug = $${values.length}`);
  }

  if (typeof filters.maxPriceCents === "number") {
    values.push(filters.maxPriceCents);
    where.push(`p.price_cents <= $${values.length}`);
  }

  if (includeBrand && filters.brand) {
    values.push(filters.brand);
    where.push(`p.brand = $${values.length}`);
  }

  if (filters.inStock) {
    where.push("p.stock_quantity > 0");
  }

  return { where, values };
}

function activeOrderBy(sort: ProductListFilters["sort"]): string {
  if (sort === "price-low") return "p.price_cents ASC, p.name ASC";
  if (sort === "price-high") return "p.price_cents DESC, p.name ASC";
  return "p.created_at DESC, p.name ASC";
}

// A caller-supplied limit is clamped. An absent limit keeps the historical full read, which
// the admin order search no longer uses.
function boundedLimit(limit: number | undefined): number | null {
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 100) return null;
  return limit;
}

export async function findActiveProducts(filters: ActiveProductFilters = {}): Promise<ProductRow[]> {
  const { where, values } = activeWhere(filters);
  const limit = boundedLimit(filters.limit);
  let sql = `SELECT ${PRODUCT_COLUMNS}
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE ${where.join(" AND ")}
     ORDER BY ${activeOrderBy(filters.sort)}`;

  if (limit !== null) {
    values.push(limit);
    sql += ` LIMIT $${values.length}`;
    const offset = Number.isInteger(filters.offset) && (filters.offset as number) > 0 ? (filters.offset as number) : 0;
    values.push(offset);
    sql += ` OFFSET $${values.length}`;
  }

  return query<ProductRow>(sql, values);
}

export async function countActiveProducts(filters: ActiveProductFilters = {}): Promise<number> {
  const { where, values } = activeWhere(filters);
  const rows = await query<{ count: string }>(
    `SELECT count(*) AS count
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE ${where.join(" AND ")}`,
    values,
  );
  return Number.parseInt(rows[0]?.count ?? "0", 10);
}

export async function findActiveBrands(filters: ActiveProductFilters = {}): Promise<string[]> {
  const { where, values } = activeWhere(filters, false);
  const rows = await query<{ brand: string }>(
    `SELECT DISTINCT p.brand AS brand
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE ${where.join(" AND ")} AND p.brand IS NOT NULL AND btrim(p.brand) <> ''
     ORDER BY p.brand ASC`,
    values,
  );
  return rows.map((row) => row.brand);
}

export async function findPublicProductPaths(): Promise<{ slug: string; updated_at: string }[]> {
  return query<{ slug: string; updated_at: string }>(
    `SELECT slug, updated_at
     FROM products
     WHERE is_active = true
     ORDER BY updated_at DESC`,
  );
}

export async function findFeaturedProducts(limit: number): Promise<ProductRow[]> {
  return query<ProductRow>(
    `SELECT ${PRODUCT_COLUMNS}
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.is_active = true
     ORDER BY p.created_at DESC, p.name ASC
     LIMIT $1`,
    [limit],
  );
}

export async function findActiveProductBySlug(slug: string): Promise<ProductRow | null> {
  const rows = await query<ProductRow>(
    `SELECT p.id, p.slug, p.sku, p.name, p.description, p.price_cents, p.currency, p.brand, p.image_url, p.stock_quantity,
            p.created_at, p.updated_at, c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.slug = $1 AND p.is_active = true
     LIMIT 1`,
    [slug],
  );

  return rows[0] ?? null;
}

export async function findCategories(): Promise<CategoryRow[]> {
  return query<CategoryRow>(
    `SELECT id, slug, name, display_order, image_url
     FROM categories
     ORDER BY display_order ASC, name ASC`,
  );
}

// --- Admin reads ----------------------------------------------------------
// These power the admin panel and, unlike `findActiveProducts`/`findCategories`
// above, are not filtered to what customers can currently see: the admin list
// must surface inactive products too so staff can manage the whole catalog.

export interface ProductAdminRow extends QueryResultRow {
  id: string;
  sku: string;
  slug: string;
  name: string;
  brand: string | null;
  price_cents: string;
  currency: string;
  stock_quantity: number;
  is_active: boolean;
  category_name: string | null;
  image_url: string | null;
}

export interface ProductAdminDetailRow extends QueryResultRow {
  id: string;
  category_id: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  price_cents: string;
  currency: string;
  image_url: string | null;
  brand: string | null;
  stock_quantity: number;
  is_active: boolean;
}

export interface CategoryOptionRow extends QueryResultRow {
  id: string;
  name: string;
}

export interface CategoryAdminRow extends QueryResultRow {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
  display_order: number;
  parent_name: string | null;
}

export interface CategoryAdminDetailRow extends QueryResultRow {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  image_url: string | null;
  display_order: number;
}

export interface ProductAdminListResult {
  rows: ProductAdminRow[];
  total: number;
}

export async function findAllProductsForAdmin(filters: ProductAdminListFilters = {}): Promise<ProductAdminListResult> {
  const where: string[] = [];
  const values: unknown[] = [];

  if (filters.search) {
    values.push(`%${filters.search}%`);
    where.push(`(p.name ILIKE $${values.length} OR p.sku ILIKE $${values.length} OR p.slug ILIKE $${values.length})`);
  }

  if (filters.status === "active" || filters.status === "inactive") {
    values.push(filters.status === "active");
    where.push(`p.is_active = $${values.length}`);
  }

  if (filters.missingImage) {
    where.push(`(p.image_url IS NULL OR btrim(p.image_url) = '')`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const countRows = await query<{ count: string }>(`SELECT count(*) FROM products p ${whereSql}`, values);

  // `filters.page` is expected to already be a validated positive integer
  // (see productAdminPageSchema in ./schemas); this guard only protects
  // against a caller that bypasses that validation. It is never built from a
  // raw string — only a hardcoded fallback or the already-typed number.
  const page = Number.isInteger(filters.page) && (filters.page as number) > 0 ? (filters.page as number) : 1;
  const listValues = [...values, PRODUCT_ADMIN_PAGE_SIZE, (page - 1) * PRODUCT_ADMIN_PAGE_SIZE];

  const rows = await query<ProductAdminRow>(
    `SELECT p.id, p.sku, p.slug, p.name, p.brand, p.price_cents, p.currency, p.stock_quantity, p.is_active, p.image_url, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ${whereSql}
     ORDER BY p.updated_at DESC, p.name ASC
     LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues,
  );

  return { rows, total: Number.parseInt(countRows[0]?.count ?? "0", 10) };
}

export async function findProductByIdForAdmin(id: string): Promise<ProductAdminDetailRow | null> {
  const rows = await query<ProductAdminDetailRow>(
    `SELECT id, category_id, sku, slug, name, description, price_cents, currency, image_url, brand, stock_quantity, is_active
     FROM products
     WHERE id = $1
     LIMIT 1`,
    [id],
  );

  return rows[0] ?? null;
}

export async function findCategoryOptions(): Promise<CategoryOptionRow[]> {
  return query<CategoryOptionRow>("SELECT id, name FROM categories ORDER BY display_order ASC, name ASC");
}

export async function findCategoryOptionsExcluding(id: string): Promise<CategoryOptionRow[]> {
  return query<CategoryOptionRow>(
    "SELECT id, name FROM categories WHERE id <> $1 ORDER BY display_order ASC, name ASC",
    [id],
  );
}

export async function findAllCategoriesForAdmin(): Promise<CategoryAdminRow[]> {
  return query<CategoryAdminRow>(
    `SELECT c.id, c.slug, c.name, c.image_url, c.display_order, p.name AS parent_name
     FROM categories c
     LEFT JOIN categories p ON p.id = c.parent_id
     ORDER BY c.display_order ASC, c.name ASC`,
  );
}

export async function findCategoryByIdForAdmin(id: string): Promise<CategoryAdminDetailRow | null> {
  const rows = await query<CategoryAdminDetailRow>(
    "SELECT id, parent_id, slug, name, image_url, display_order FROM categories WHERE id = $1 LIMIT 1",
    [id],
  );

  return rows[0] ?? null;
}

export async function insertProduct(input: ProductAdminInput): Promise<void> {
  await query(
    `INSERT INTO products (category_id, sku, slug, name, description, price_cents, currency, image_url, brand, stock_quantity, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [input.categoryId, input.sku, input.slug, input.name, input.description, input.priceCents, input.currency, input.imageUrl, input.brand, input.stockQuantity, input.isActive],
  );
}

/** Upserts by SKU so CSV re-imports refresh existing catalog rows instead of failing. */
export async function upsertProductBySku(input: ProductAdminInput): Promise<"inserted" | "updated"> {
  const existing = await query<{ id: string }>("SELECT id FROM products WHERE lower(sku) = lower($1) LIMIT 1", [input.sku]);
  if (existing[0]) {
    await query(
      `UPDATE products
       SET category_id = $2, slug = $3, name = $4, description = $5, price_cents = $6,
           currency = $7, brand = $8, stock_quantity = $9, is_active = $10, updated_at = now()
       WHERE id = $1`,
      [
        existing[0].id,
        input.categoryId,
        input.slug,
        input.name,
        input.description,
        input.priceCents,
        input.currency,
        input.brand,
        input.stockQuantity,
        input.isActive,
      ],
    );
    return "updated";
  }

  await insertProduct(input);
  return "inserted";
}

export async function findCategoryIdByName(name: string): Promise<string | null> {
  const rows = await query<{ id: string }>(
    "SELECT id FROM categories WHERE lower(name) = lower($1) LIMIT 1",
    [name],
  );
  return rows[0]?.id ?? null;
}

export async function countAllProducts(): Promise<number> {
  const rows = await query<{ count: string }>("SELECT count(*)::text AS count FROM products");
  return Number.parseInt(rows[0]?.count ?? "0", 10);
}

export async function updateProductById(input: ProductAdminUpdateInput): Promise<void> {
  const shouldUpdateImage = Object.hasOwn(input, "imageUrl");

  await query(
    `UPDATE products
     SET category_id = $2, sku = $3, slug = $4, name = $5, description = $6, price_cents = $7,
        currency = $8, image_url = CASE WHEN $9 THEN $10 ELSE image_url END, brand = $11, stock_quantity = $12, is_active = $13
     WHERE id = $1`,
    [input.id, input.categoryId, input.sku, input.slug, input.name, input.description, input.priceCents, input.currency, shouldUpdateImage, input.imageUrl, input.brand, input.stockQuantity, input.isActive],
  );
}

export async function deleteProductById(id: string): Promise<void> {
  await query("DELETE FROM products WHERE id = $1", [id]);
}

export async function insertCategory(input: CategoryAdminInput): Promise<void> {
  await query(
    // `position` mirrors `display_order` for the legacy column that has not been
    // dropped yet; both must stay in sync until it is removed in a later migration.
    `INSERT INTO categories (parent_id, slug, name, image_url, display_order, position)
     VALUES ($1, $2, $3, $4, $5, $5)`,
    [input.parentId, input.slug, input.name, input.imageUrl, input.displayOrder],
  );
}

export async function updateCategoryById(input: CategoryAdminUpdateInput): Promise<void> {
  const shouldUpdateImage = Object.hasOwn(input, "imageUrl");

  await query(
    `UPDATE categories
     SET parent_id = $2, slug = $3, name = $4, image_url = CASE WHEN $5 THEN $6 ELSE image_url END, display_order = $7, position = $7
     WHERE id = $1`,
    [input.id, input.parentId, input.slug, input.name, shouldUpdateImage, input.imageUrl, input.displayOrder],
  );
}

export async function deleteCategoryById(id: string): Promise<void> {
  await query("DELETE FROM categories WHERE id = $1", [id]);
}
