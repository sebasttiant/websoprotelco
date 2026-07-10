import * as repository from "./repository";
import type { ProductRow } from "./repository";
import type {
  CategoryAdminInput,
  CategorySummary,
  ProductAdminInput,
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
