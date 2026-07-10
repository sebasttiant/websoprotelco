// Next resolves this specifier through its own bundled copy, so it needs no entry in
// package.json. It fails the build if a client component ever reaches this module.
// It belongs here rather than in server/db/pool.ts, because the migration scripts import
// the pool directly under tsx, where no bundler rewrites the specifier.
import "server-only";

import type { QueryResultRow } from "pg";

import { query } from "@/server/db/pool";

import type { CategoryAdminInput, ProductAdminInput, ProductListFilters } from "./schemas";

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

export async function findActiveProducts(filters: ProductListFilters = {}): Promise<ProductRow[]> {
  const where: string[] = ["p.is_active = true"];
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

  const orderBy = filters.sort === "price-low"
    ? "p.price_cents ASC, p.name ASC"
    : filters.sort === "price-high"
      ? "p.price_cents DESC, p.name ASC"
      : "p.created_at DESC, p.name ASC";

  return query<ProductRow>(
    `SELECT ${PRODUCT_COLUMNS}
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE ${where.join(" AND ")}
     ORDER BY ${orderBy}`,
    values,
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

export async function insertProduct(input: ProductAdminInput): Promise<void> {
  await query(
    `INSERT INTO products (category_id, sku, slug, name, description, price_cents, currency, image_url, brand, stock_quantity, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [input.categoryId, input.sku, input.slug, input.name, input.description, input.priceCents, input.currency, input.imageUrl, input.brand, input.stockQuantity, input.isActive],
  );
}

export async function updateProductById(input: ProductAdminInput & { id: string }): Promise<void> {
  await query(
    `UPDATE products
     SET category_id = $2, sku = $3, slug = $4, name = $5, description = $6, price_cents = $7,
         currency = $8, image_url = $9, brand = $10, stock_quantity = $11, is_active = $12
     WHERE id = $1`,
    [input.id, input.categoryId, input.sku, input.slug, input.name, input.description, input.priceCents, input.currency, input.imageUrl, input.brand, input.stockQuantity, input.isActive],
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

export async function updateCategoryById(input: CategoryAdminInput & { id: string }): Promise<void> {
  await query(
    `UPDATE categories
     SET parent_id = $2, slug = $3, name = $4, image_url = $5, display_order = $6, position = $6
     WHERE id = $1`,
    [input.id, input.parentId, input.slug, input.name, input.imageUrl, input.displayOrder],
  );
}

export async function deleteCategoryById(id: string): Promise<void> {
  await query("DELETE FROM categories WHERE id = $1", [id]);
}
