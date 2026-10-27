"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { z } from "zod";

import { parsePesosInput, pesosToCents } from "@/lib/money";
import { slugifyName } from "@/lib/slugify";
import { requirePermission } from "@/server/auth/guards";

import { catalogDeleteInputSchema, categoryAdminInputSchema, getEffectivePriceCents, isSafeCatalogImagePath, productAdminInputSchema, productAdminUpdateSchema } from "./schemas";
import * as catalogService from "./service";

export interface AdminActionState {
  success: boolean;
  message: string;
}

function formValue(formData: FormData, key: string): FormDataEntryValue | null {
  return formData.get(key);
}

function stringValue(formData: FormData, key: string): string | undefined {
  const value = formValue(formData, key);
  return typeof value === "string" ? value : undefined;
}

function resolvePriceCents(formData: FormData): string {
  // Prefer human pesos from the admin form. Legacy/tests may still post priceCents.
  const pesosRaw = stringValue(formData, "pricePesos");
  if (pesosRaw !== undefined && pesosRaw.trim() !== "") {
    return String(pesosToCents(parsePesosInput(pesosRaw)));
  }
  return stringValue(formData, "priceCents") ?? "0";
}

function resolvePromoPriceCents(formData: FormData): number | string | null {
  // Blank field means "no promotion". Legacy/tests may post promoPriceCents directly.
  const pesosRaw = stringValue(formData, "promoPricePesos");
  if (pesosRaw !== undefined) {
    return pesosRaw.trim() === "" ? null : pesosToCents(parsePesosInput(pesosRaw));
  }
  const centsRaw = stringValue(formData, "promoPriceCents");
  if (centsRaw === undefined || centsRaw.trim() === "") return null;
  // Strict digits only: parseInt("199junk") / parseInt("199.99") would silently become 199
  // and pass the integer schema. Hand the raw token to Zod when it is not a whole number.
  const trimmed = centsRaw.trim();
  if (!/^\d+$/.test(trimmed)) return trimmed;
  return Number.parseInt(trimmed, 10);
}

function resolveSlug(formData: FormData): string {
  const explicit = stringValue(formData, "slug")?.trim() ?? "";
  if (explicit) return explicit;
  return slugifyName(stringValue(formData, "name") ?? "");
}

function productInput(formData: FormData): Record<string, unknown> {
  const input: Record<string, unknown> = {
    id: stringValue(formData, "id"),
    categoryId: stringValue(formData, "categoryId"),
    sku: stringValue(formData, "sku"),
    slug: resolveSlug(formData),
    name: stringValue(formData, "name"),
    description: stringValue(formData, "description") ?? "",
    priceCents: resolvePriceCents(formData),
    promoPriceCents: resolvePromoPriceCents(formData),
    isFeatured: formData.has("isFeatured"),
    currency: stringValue(formData, "currency") ?? "COP",
    brand: stringValue(formData, "brand"),
    stockQuantity: stringValue(formData, "stockQuantity") ?? "0",
    isActive: formData.has("isActive"),
  };
  if (formData.has("imageUrl")) input.imageUrl = stringValue(formData, "imageUrl");
  return input;
}

function categoryInput(formData: FormData): Record<string, unknown> {
  const name = stringValue(formData, "name");
  const explicitSlug = stringValue(formData, "slug")?.trim() ?? "";
  const input: Record<string, unknown> = {
    id: stringValue(formData, "id"),
    parentId: stringValue(formData, "parentId") ?? null,
    slug: explicitSlug || slugifyName(name ?? ""),
    name,
    // Category images are not used on the storefront; omit the upload field and keep null.
    imageUrl: formData.has("imageUrl") ? stringValue(formData, "imageUrl") : null,
    displayOrder: stringValue(formData, "displayOrder") ?? "0",
  };
  return input;
}

function keepLegacyImageOnUnchangedUpdate(input: Record<string, unknown>, currentImageUrl: string | null | undefined): Record<string, unknown> {
  const imageUrl = typeof input.imageUrl === "string" ? input.imageUrl.trim() : "";

  if (imageUrl !== "" && imageUrl === currentImageUrl && !isSafeCatalogImagePath(imageUrl)) {
    const withoutImageUrl = { ...input };
    delete withoutImageUrl.imageUrl;
    return withoutImageUrl;
  }

  return input;
}

function errorState(error: unknown): AdminActionState {
  if (isRedirectError(error)) {
    throw error;
  }

  if (error instanceof z.ZodError) {
    return { success: false, message: error.issues[0]?.message ?? "Invalid input." };
  }

  console.error("Catalog admin action failed:", error);
  return { success: false, message: "The operation could not be completed." };
}

function redirectWithSuccess(pathname: string, code: string): never {
  redirect(`${pathname}?success=${code}`);
}

function redirectWithError(pathname: string, code = "action-failed"): never {
  redirect(`${pathname}?error=${code}`);
}

export async function createProduct(formData: FormData): Promise<AdminActionState> {
  await requirePermission("catalog:write");

  try {
    const input = productAdminInputSchema.parse(productInput(formData));

    await catalogService.createProduct(input);

    revalidatePath("/admin/products");
    revalidatePath("/productos");
    redirectWithSuccess("/admin/products", "product-created");
  } catch (error) {
    errorState(error);
    redirectWithError("/admin/products/new");
  }
}

export async function updateProduct(formData: FormData): Promise<AdminActionState> {
  await requirePermission("catalog:write");
  const productId = stringValue(formData, "id");

  try {
    const currentProduct = productId ? await catalogService.getProductByIdForAdmin(productId).catch(() => null) : null;
    const input = productAdminUpdateSchema.parse(keepLegacyImageOnUnchangedUpdate(productInput(formData), currentProduct?.imageUrl));

    await catalogService.updateProduct(input);

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${input.id}`);
    revalidatePath("/productos");
    redirectWithSuccess("/admin/products", "product-updated");
  } catch (error) {
    errorState(error);
    redirectWithError(productId ? `/admin/products/${productId}` : "/admin/products");
  }
}

export async function importProductsCsv(formData: FormData): Promise<AdminActionState> {
  await requirePermission("catalog:write");

  try {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      redirectWithError("/admin/products/import", "import-failed");
    }

    const text = await file.text();
    if (text.length > 2_000_000) {
      redirectWithError("/admin/products/import", "import-failed");
    }

    const result = await catalogService.importProductsFromCsv(text);
    revalidatePath("/admin/products");
    revalidatePath("/productos");
    revalidatePath("/admin");

    if (result.inserted + result.updated === 0) {
      redirectWithError("/admin/products/import", "import-failed");
    }

    redirectWithSuccess(
      `/admin/products?imported=${result.inserted}&updated=${result.updated}&skipped=${result.skipped}`,
      "products-imported",
    );
  } catch (error) {
    errorState(error);
    redirectWithError("/admin/products/import", "import-failed");
  }
}

export async function deleteProduct(formData: FormData): Promise<AdminActionState> {
  await requirePermission("catalog:write");

  try {
    const input = catalogDeleteInputSchema.parse({ id: formValue(formData, "id") });
    await catalogService.deleteProduct(input.id);
    revalidatePath("/admin/products");
    revalidatePath("/productos");
    redirectWithSuccess("/admin/products", "product-deleted");
  } catch (error) {
    errorState(error);
    redirectWithError("/admin/products");
  }
}

export async function createCategory(formData: FormData): Promise<AdminActionState> {
  await requirePermission("catalog:write");

  try {
    const input = categoryAdminInputSchema.parse(categoryInput(formData));

    await catalogService.createCategory(input);

    revalidatePath("/admin/categories");
    revalidatePath("/productos");
    redirectWithSuccess("/admin/categories", "category-created");
  } catch (error) {
    errorState(error);
    redirectWithError("/admin/categories/new");
  }
}

export async function updateCategory(formData: FormData): Promise<AdminActionState> {
  await requirePermission("catalog:write");
  const categoryId = stringValue(formData, "id");

  try {
    const currentCategory = categoryId ? await catalogService.getCategoryByIdForAdmin(categoryId).catch(() => null) : null;
    const input = categoryAdminInputSchema.required({ id: true }).partial({ imageUrl: true }).parse(keepLegacyImageOnUnchangedUpdate(categoryInput(formData), currentCategory?.imageUrl));

    await catalogService.updateCategory(input);

    revalidatePath("/admin/categories");
    revalidatePath(`/admin/categories/${input.id}`);
    revalidatePath("/productos");
    redirectWithSuccess("/admin/categories", "category-updated");
  } catch (error) {
    errorState(error);
    redirectWithError(categoryId ? `/admin/categories/${categoryId}` : "/admin/categories");
  }
}

export interface OrderProductMatch {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  categoryName: string;
}

// The order screen used to ship every active product to the browser. With a catalog of
// thousands that freezes the panel, so the operator searches a bounded page instead.
export async function searchOrderProducts(term: string): Promise<OrderProductMatch[]> {
  await requirePermission("quote:write");
  const parsed = z.string().trim().max(80).safeParse(term);
  if (!parsed.success || parsed.data.length < 2) return [];

  const products = await catalogService.getProducts({ search: parsed.data, limit: 8 });
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    // The preview must agree with what the server will charge: promo price when set.
    priceCents: getEffectivePriceCents(product),
    categoryName: product.categoryName,
  }));
}

export async function deleteCategory(formData: FormData): Promise<AdminActionState> {
  await requirePermission("catalog:write");

  try {
    const input = catalogDeleteInputSchema.parse({ id: formValue(formData, "id") });
    await catalogService.deleteCategory(input.id);
    revalidatePath("/admin/categories");
    revalidatePath("/productos");
    redirectWithSuccess("/admin/categories", "category-deleted");
  } catch (error) {
    errorState(error);
    redirectWithError("/admin/categories");
  }
}
