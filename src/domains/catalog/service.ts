import * as repository from "./repository";
import type { ProductRow } from "./repository";
import { PRODUCT_ADMIN_PAGE_SIZE, productAdminPageSchema } from "./schemas";
import type {
  CategoryAdminDetail,
  CategoryAdminInput,
  CategoryAdminSummary,
  CategoryOption,
  CategorySummary,
  ProductAdminDetail,
  ProductAdminInput,
  ProductAdminListFilters,
  ProductAdminListResult,
  ProductAdminSummary,
  ProductDetail,
  ProductListFilters,
  ProductSummary,
} from "./schemas";

function toNumber(value: string): number {
  return Number.parseInt(value, 10);
}

function inferBrand(name: string, sku: string): string {
  const firstToken = name.split(/\s+/).find(Boolean);
  return firstToken && firstToken.length > 2 ? firstToken : sku.split("-")[0] || "SOPROTELCO";
}

function mapProductSummary(row: ProductRow): ProductSummary {
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

function mapCategorySummary(row: repository.CategoryRow): CategorySummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    position: row.display_order,
    imageUrl: row.image_url,
  };
}

function mapProductAdminSummary(row: repository.ProductAdminRow): ProductAdminSummary {
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    priceCents: toNumber(row.price_cents),
    currency: row.currency,
    stockQuantity: row.stock_quantity,
    isActive: row.is_active,
    categoryName: row.category_name,
  };
}

function mapProductAdminDetail(row: repository.ProductAdminDetailRow): ProductAdminDetail {
  return {
    id: row.id,
    categoryId: row.category_id,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceCents: toNumber(row.price_cents),
    currency: row.currency,
    imageUrl: row.image_url,
    brand: row.brand,
    stockQuantity: row.stock_quantity,
    isActive: row.is_active,
  };
}

function mapCategoryOption(row: repository.CategoryOptionRow): CategoryOption {
  return { id: row.id, name: row.name };
}

function mapCategoryAdminSummary(row: repository.CategoryAdminRow): CategoryAdminSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    imageUrl: row.image_url,
    displayOrder: row.display_order,
    parentName: row.parent_name,
  };
}

function mapCategoryAdminDetail(row: repository.CategoryAdminDetailRow): CategoryAdminDetail {
  return {
    id: row.id,
    parentId: row.parent_id,
    slug: row.slug,
    name: row.name,
    imageUrl: row.image_url,
    displayOrder: row.display_order,
  };
}

export async function getProducts(filters: ProductListFilters = {}): Promise<ProductSummary[]> {
  const rows = await repository.findActiveProducts(filters);
  return rows.map(mapProductSummary);
}

export async function getFeaturedProducts(limit = 6): Promise<ProductSummary[]> {
  const rows = await repository.findFeaturedProducts(limit);
  return rows.map(mapProductSummary);
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const row = await repository.findActiveProductBySlug(slug);

  if (!row || !row.created_at || !row.updated_at) {
    return null;
  }

  return {
    ...mapProductSummary(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCategories(): Promise<CategorySummary[]> {
  const rows = await repository.findCategories();
  return rows.map(mapCategorySummary);
}

// Unlike getProducts()/getFeaturedProducts() above, this deliberately returns
// every product regardless of `is_active` — admin staff manage the full
// catalog, not just what customers can currently see.
export async function getProductsForAdmin(filters: ProductAdminListFilters = {}): Promise<ProductAdminListResult> {
  const page = productAdminPageSchema.parse(filters.page);
  const { rows, total } = await repository.findAllProductsForAdmin({ ...filters, page });
  const totalPages = Math.max(1, Math.ceil(total / PRODUCT_ADMIN_PAGE_SIZE));

  return {
    rows: rows.map(mapProductAdminSummary),
    total,
    totalPages,
    page: Math.min(page, totalPages),
  };
}

export async function getProductByIdForAdmin(id: string): Promise<ProductAdminDetail | null> {
  const row = await repository.findProductByIdForAdmin(id);
  return row ? mapProductAdminDetail(row) : null;
}

export async function getCategoryOptions(): Promise<CategoryOption[]> {
  const rows = await repository.findCategoryOptions();
  return rows.map(mapCategoryOption);
}

export async function getCategoryOptionsExcluding(id: string): Promise<CategoryOption[]> {
  const rows = await repository.findCategoryOptionsExcluding(id);
  return rows.map(mapCategoryOption);
}

export async function getCategoriesForAdmin(): Promise<CategoryAdminSummary[]> {
  const rows = await repository.findAllCategoriesForAdmin();
  return rows.map(mapCategoryAdminSummary);
}

export async function getCategoryByIdForAdmin(id: string): Promise<CategoryAdminDetail | null> {
  const row = await repository.findCategoryByIdForAdmin(id);
  return row ? mapCategoryAdminDetail(row) : null;
}

export async function createProduct(input: ProductAdminInput): Promise<void> {
  await repository.insertProduct(input);
}

export async function updateProduct(input: ProductAdminInput & { id: string }): Promise<void> {
  await repository.updateProductById(input);
}

export async function deleteProduct(id: string): Promise<void> {
  await repository.deleteProductById(id);
}

export async function createCategory(input: CategoryAdminInput): Promise<void> {
  await repository.insertCategory(input);
}

export async function updateCategory(input: CategoryAdminInput & { id: string }): Promise<void> {
  await repository.updateCategoryById(input);
}

export async function deleteCategory(id: string): Promise<void> {
  await repository.deleteCategoryById(id);
}
