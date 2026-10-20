import { parsePesosInput, pesosToCents } from "@/lib/money";
import { slugifyName } from "@/lib/slugify";

import * as repository from "./repository";
import type { ProductRow } from "./repository";
import { CATALOG_PAGE_SIZE, getSafeCatalogImageUrl, PRODUCT_ADMIN_PAGE_SIZE, productAdminPageSchema } from "./schemas";
import type {
  CategoryAdminDetail,
  CategoryAdminInput,
  CategoryAdminUpdateInput,
  CategoryAdminSummary,
  CategoryOption,
  CategorySummary,
  ProductAdminDetail,
  ProductAdminInput,
  ProductAdminUpdateInput,
  ProductAdminListFilters,
  ProductAdminListResult,
  ProductAdminSummary,
  ProductDetail,
  ProductCatalogPage,
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
    promoPriceCents: row.promo_price_cents === null || row.promo_price_cents === undefined ? null : toNumber(row.promo_price_cents),
    isFeatured: row.is_featured ?? false,
    currency: row.currency,
    categoryName: row.category_name ?? "Connectivity",
    categorySlug: row.category_slug ?? "connectivity",
    brand: row.brand ?? inferBrand(row.name, row.sku),
    imageUrl: getSafeCatalogImageUrl(row.image_url),
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
    promoPriceCents: row.promo_price_cents == null ? null : toNumber(row.promo_price_cents),
    isFeatured: row.is_featured ?? false,
    currency: row.currency,
    stockQuantity: row.stock_quantity,
    isActive: row.is_active,
    categoryName: row.category_name,
    imageUrl: row.image_url,
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
    promoPriceCents: row.promo_price_cents == null ? null : toNumber(row.promo_price_cents),
    isFeatured: row.is_featured ?? false,
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

export interface ProductCatalogQuery extends ProductListFilters {
  brand?: string;
  inStock?: boolean;
  page?: number;
}

export async function getProductCatalog(filters: ProductCatalogQuery = {}): Promise<ProductCatalogPage> {
  const total = await repository.countActiveProducts(filters);
  const totalPages = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
  const requested = Number.isInteger(filters.page) && (filters.page as number) > 0 ? (filters.page as number) : 1;
  const page = Math.min(requested, totalPages);
  const [rows, brands] = await Promise.all([
    total === 0
      ? Promise.resolve([])
      : repository.findActiveProducts({ ...filters, limit: CATALOG_PAGE_SIZE, offset: (page - 1) * CATALOG_PAGE_SIZE }),
    repository.findActiveBrands(filters),
  ]);

  return {
    products: rows.map(mapProductSummary),
    total,
    page,
    pageSize: CATALOG_PAGE_SIZE,
    brands,
  };
}

export async function listPublicProductPaths(): Promise<{ slug: string; updatedAt: string }[]> {
  const rows = await repository.findPublicProductPaths();
  return rows.map((row) => ({ slug: row.slug, updatedAt: row.updated_at }));
}

export async function getFeaturedProducts(limit = 6): Promise<ProductSummary[]> {
  const rows = await repository.findFeaturedProducts(limit);
  return rows.map(mapProductSummary);
}

/** Products the admin marked as Top or put on promotion, for the home impact section. */
export async function getPromotedProducts(limit = 4): Promise<ProductSummary[]> {
  const rows = await repository.findPromotedProducts(limit);
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

export async function upsertProductBySku(input: ProductAdminInput): Promise<"inserted" | "updated"> {
  return repository.upsertProductBySku(input);
}

export async function resolveCategoryIdByName(name: string): Promise<string | null> {
  return repository.findCategoryIdByName(name.trim());
}

export async function countAllProducts(): Promise<number> {
  return repository.countAllProducts();
}

export interface ProductCsvImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * Imports catalog rows from a simple CSV. Expected headers (Spanish or English):
 * sku,name,category,price_pesos,stock,brand,description,active,slug
 */
export async function importProductsFromCsv(csvText: string): Promise<ProductCsvImportResult> {
  const parsedCsv = parseCsvRows(csvText.replace(/^\uFEFF/, ""));

  if (!parsedCsv.ok) {
    return {
      inserted: 0,
      updated: 0,
      skipped: 1,
      errors: [`Fila ${parsedCsv.rowNumber}: hay comillas sin cerrar.`],
    };
  }

  const rows = parsedCsv.rows;
  if (rows.length < 2) {
    return { inserted: 0, updated: 0, skipped: 0, errors: ["El CSV está vacío o solo tiene encabezados."] };
  }

  const header = rows[0]!.map((cell) => cell.trim().toLowerCase());
  const indexOf = (aliases: string[]) => header.findIndex((cell) => aliases.includes(cell));

  const skuIdx = indexOf(["sku", "codigo", "código"]);
  const nameIdx = indexOf(["name", "nombre"]);
  const categoryIdx = indexOf(["category", "categoria", "categoría"]);
  const priceIdx = indexOf(["price_pesos", "precio", "price", "precio_pesos"]);
  const stockIdx = indexOf(["stock", "stock_quantity", "cantidad"]);
  const brandIdx = indexOf(["brand", "marca"]);
  const descriptionIdx = indexOf(["description", "descripcion", "descripción"]);
  const activeIdx = indexOf(["active", "activo", "is_active"]);
  const slugIdx = indexOf(["slug", "url"]);

  if (skuIdx < 0 || nameIdx < 0 || categoryIdx < 0 || priceIdx < 0) {
    return {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: ["Faltan columnas obligatorias: sku, name/nombre, category/categoría, price_pesos/precio."],
    };
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const rowNumber = i + 1;
    const cells = rows[i]!;

    if (cells.length !== header.length) {
      skipped += 1;
      errors.push(`Fila ${rowNumber}: cantidad de columnas inválida; revisá campos con comas y stock.`);
      continue;
    }

    const sku = (cells[skuIdx] ?? "").trim();
    const name = (cells[nameIdx] ?? "").trim();
    const categoryName = (cells[categoryIdx] ?? "").trim();
    const priceRaw = (cells[priceIdx] ?? "").trim();

    if (!sku || !name || !categoryName || !priceRaw) {
      skipped += 1;
      errors.push(`Fila ${rowNumber}: faltan sku, nombre, categoría o precio.`);
      continue;
    }

    const slugCell = slugIdx >= 0 ? (cells[slugIdx] ?? "").trim() : "";
    const stockRaw = stockIdx >= 0 ? (cells[stockIdx] ?? "0").trim() : "0";
    const stockQuantity = parseCsvStock(stockRaw);
    if (stockQuantity === null) {
      skipped += 1;
      errors.push(`Fila ${rowNumber}: stock debe ser un número entero no negativo.`);
      continue;
    }

    const categoryId = await repository.findCategoryIdByName(categoryName);
    if (!categoryId) {
      skipped += 1;
      errors.push(`Fila ${rowNumber}: categoría "${categoryName}" no existe. Creala antes de importar.`);
      continue;
    }

    const brand = brandIdx >= 0 ? (cells[brandIdx] ?? "").trim() || null : null;
    const description = descriptionIdx >= 0 ? (cells[descriptionIdx] ?? "").trim() : "";
    const activeRaw = activeIdx >= 0 ? (cells[activeIdx] ?? "1").trim().toLowerCase() : "1";
    const isActive = !["0", "false", "no", "inactivo", "inactive"].includes(activeRaw);

    try {
      const input = {
        categoryId,
        sku,
        slug: slugCell || slugifyName(name),
        name,
        description,
        priceCents: pesosToCents(parsePesosInput(priceRaw)),
        promoPriceCents: null,
        isFeatured: false,
        currency: "COP",
        imageUrl: null as string | null,
        brand,
        stockQuantity,
        isActive,
      };
      const outcome = await repository.upsertProductBySku(input);
      if (outcome === "inserted") inserted += 1;
      else updated += 1;
    } catch (error) {
      skipped += 1;
      errors.push(`Fila ${rowNumber}: ${error instanceof Error ? error.message : "error al guardar"}`);
    }
  }

  return { inserted, updated, skipped, errors: errors.slice(0, 20) };
}

interface ParsedCsvRows {
  ok: true;
  rows: string[][];
}

interface InvalidCsvRows {
  ok: false;
  rowNumber: number;
}

const CSV_CELL_STATE = {
  UNQUOTED: "unquoted",
  QUOTED: "quoted",
  AFTER_QUOTE: "after-quote",
} as const;

type CsvCellState = (typeof CSV_CELL_STATE)[keyof typeof CSV_CELL_STATE];

function parseCsvRows(csvText: string): ParsedCsvRows | InvalidCsvRows {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let state: CsvCellState = CSV_CELL_STATE.UNQUOTED;

  const pushRow = () => {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    row = [];
    cell = "";
    state = CSV_CELL_STATE.UNQUOTED;
  };

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index]!;

    if (state === CSV_CELL_STATE.QUOTED) {
      if (char === '"') {
        if (csvText[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          state = CSV_CELL_STATE.AFTER_QUOTE;
        }
      } else if (char === "\n" || char === "\r") {
        cell += "\n";
        if (char === "\r" && csvText[index + 1] === "\n") index += 1;
      } else {
        cell += char;
      }
      continue;
    }

    if (state === CSV_CELL_STATE.AFTER_QUOTE) {
      if (char === ",") {
        row.push(cell);
        cell = "";
        state = CSV_CELL_STATE.UNQUOTED;
      } else if (char === "\n" || char === "\r") {
        pushRow();
        if (char === "\r" && csvText[index + 1] === "\n") index += 1;
      } else if (char !== " " && char !== "\t") {
        return { ok: false, rowNumber: rows.length + 1 };
      }
      continue;
    }

    if (char === '"') {
      if (cell !== "") return { ok: false, rowNumber: rows.length + 1 };
      state = CSV_CELL_STATE.QUOTED;
      continue;
    }

    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n" || char === "\r") {
      pushRow();
      if (char === "\r" && csvText[index + 1] === "\n") index += 1;
      continue;
    }

    cell += char;
  }

  if (state === CSV_CELL_STATE.QUOTED) return { ok: false, rowNumber: rows.length + 1 };
  if (cell !== "" || row.length > 0 || state === CSV_CELL_STATE.AFTER_QUOTE) pushRow();

  return { ok: true, rows };
}

function parseCsvStock(raw: string): number | null {
  if (raw === "") return 0;
  if (!/^\d+$/.test(raw)) return null;

  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

export async function updateProduct(input: ProductAdminUpdateInput): Promise<void> {
  await repository.updateProductById(input);
}

export async function deleteProduct(id: string): Promise<void> {
  await repository.deleteProductById(id);
}

export async function createCategory(input: CategoryAdminInput): Promise<void> {
  await repository.insertCategory(input);
}

export async function updateCategory(input: CategoryAdminUpdateInput): Promise<void> {
  await repository.updateCategoryById(input);
}

export async function deleteCategory(id: string): Promise<void> {
  await repository.deleteCategoryById(id);
}
