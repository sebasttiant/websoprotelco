import "server-only";

import type { QueryResultRow } from "pg";

import { query } from "@/server/db/pool";

const PRODUCT_SORT = {
  relevant: "relevant",
  priceLow: "price-low",
  priceHigh: "price-high",
} as const;

export type ProductSort = (typeof PRODUCT_SORT)[keyof typeof PRODUCT_SORT];

export interface ProductListFilters {
  search?: string;
  categorySlug?: string;
  maxPriceCents?: number;
  sort?: ProductSort;
}

export interface ProductSummary {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  categoryName: string;
  categorySlug: string;
  brand: string;
  imageUrl: string | null;
  inStock: boolean;
}

export interface ProductDetail extends ProductSummary {
  createdAt: string;
  updatedAt: string;
}

interface ProductRow extends QueryResultRow {
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

function toNumber(value: string): number {
  return Number.parseInt(value, 10);
}

function inferBrand(name: string, sku: string): string {
  const firstToken = name.split(/\s+/).find(Boolean);
  return firstToken && firstToken.length > 2 ? firstToken : sku.split("-")[0] || "SOPROTELCO";
}

function mapSummary(row: ProductRow): ProductSummary {
  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    name: row.name,
    description: row.description,
    priceCents: toNumber(row.price_cents),
    currency: row.currency,
    categoryName: row.category_name ?? "Connectivity",
    categorySlug: row.category_slug ?? "connectivity",
    brand: row.brand ?? inferBrand(row.name, row.sku),
    imageUrl: row.image_url,
    inStock: row.stock_quantity > 0,
  };
}

export async function getProducts(filters: ProductListFilters = {}): Promise<ProductSummary[]> {
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

  const orderBy = filters.sort === PRODUCT_SORT.priceLow
    ? "p.price_cents ASC, p.name ASC"
    : filters.sort === PRODUCT_SORT.priceHigh
      ? "p.price_cents DESC, p.name ASC"
      : "p.created_at DESC, p.name ASC";

  const rows = await query<ProductRow>(
    `SELECT p.id, p.slug, p.sku, p.name, p.description, p.price_cents, p.currency, p.brand, p.image_url, p.stock_quantity,
            c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE ${where.join(" AND ")}
     ORDER BY ${orderBy}`,
    values,
  );

  return rows.map(mapSummary);
}

export async function getFeaturedProducts(limit = 6): Promise<ProductSummary[]> {
  const rows = await query<ProductRow>(
    `SELECT p.id, p.slug, p.sku, p.name, p.description, p.price_cents, p.currency, p.brand, p.image_url, p.stock_quantity,
            c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.is_active = true
     ORDER BY p.created_at DESC, p.name ASC
     LIMIT $1`,
    [limit],
  );

  return rows.map(mapSummary);
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const rows = await query<ProductRow>(
    `SELECT p.id, p.slug, p.sku, p.name, p.description, p.price_cents, p.currency, p.brand, p.image_url, p.stock_quantity,
            p.created_at, p.updated_at, c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.slug = $1 AND p.is_active = true
     LIMIT 1`,
    [slug],
  );

  const row = rows[0];

  if (!row || !row.created_at || !row.updated_at) {
    return null;
  }

  return {
    ...mapSummary(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
