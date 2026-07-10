"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { z } from "zod";

import { requirePermission } from "@/server/auth/guards";
import { query } from "@/server/db/pool";

import { QUOTE_STATUSES, type QuoteStatus } from "./quote-status";

export interface AdminActionState {
  success: boolean;
  message: string;
}

const terminalQuoteStatuses = new Set<QuoteStatus>(["won", "lost", "cancelled"]);

const quoteTransitions: Readonly<Record<QuoteStatus, readonly QuoteStatus[]>> = {
  received: ["in_review", "cancelled"],
  in_review: ["quoted", "lost", "cancelled"],
  quoted: ["won", "lost", "cancelled"],
  won: [],
  lost: [],
  cancelled: [],
};

const optionalTextSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().nullable(),
);

const productSchema = z.object({
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

const categorySchema = z.object({
  id: z.uuid().optional(),
  parentId: z.preprocess((value) => (value === "" ? null : value), z.uuid().nullable()),
  slug: z.string().trim().min(1, { error: "Slug is required." }).max(120),
  name: z.string().trim().min(1, { error: "Name is required." }).max(160),
  imageUrl: optionalTextSchema,
  displayOrder: z.coerce.number().int().min(0),
});

const deleteSchema = z.object({ id: z.uuid() });

const quoteStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(QUOTE_STATUSES),
});

interface QuoteStatusRow {
  status: QuoteStatus;
}

function formValue(formData: FormData, key: string): FormDataEntryValue | null {
  return formData.get(key);
}

function stringValue(formData: FormData, key: string): string | undefined {
  const value = formValue(formData, key);
  return typeof value === "string" ? value : undefined;
}

function productInput(formData: FormData): Record<string, unknown> {
  return {
    id: stringValue(formData, "id"),
    categoryId: stringValue(formData, "categoryId"),
    sku: stringValue(formData, "sku"),
    slug: stringValue(formData, "slug"),
    name: stringValue(formData, "name"),
    description: stringValue(formData, "description") ?? "",
    priceCents: stringValue(formData, "priceCents"),
    currency: stringValue(formData, "currency") ?? "COP",
    imageUrl: stringValue(formData, "imageUrl"),
    brand: stringValue(formData, "brand"),
    stockQuantity: stringValue(formData, "stockQuantity") ?? "0",
    isActive: formData.has("isActive"),
  };
}

function categoryInput(formData: FormData): Record<string, unknown> {
  return {
    id: stringValue(formData, "id"),
    parentId: stringValue(formData, "parentId") ?? null,
    slug: stringValue(formData, "slug"),
    name: stringValue(formData, "name"),
    imageUrl: stringValue(formData, "imageUrl"),
    displayOrder: stringValue(formData, "displayOrder") ?? "0",
  };
}

function errorState(error: unknown): AdminActionState {
  if (isRedirectError(error)) {
    throw error;
  }

  if (error instanceof z.ZodError) {
    return { success: false, message: error.issues[0]?.message ?? "Invalid input." };
  }

  console.error("Admin action failed:", error);
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
    const input = productSchema.parse(productInput(formData));

    await query(
      `INSERT INTO products (category_id, sku, slug, name, description, price_cents, currency, image_url, brand, stock_quantity, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [input.categoryId, input.sku, input.slug, input.name, input.description, input.priceCents, input.currency, input.imageUrl, input.brand, input.stockQuantity, input.isActive],
    );

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
    const input = productSchema.required({ id: true }).parse(productInput(formData));

    await query(
      `UPDATE products
       SET category_id = $2, sku = $3, slug = $4, name = $5, description = $6, price_cents = $7,
           currency = $8, image_url = $9, brand = $10, stock_quantity = $11, is_active = $12
       WHERE id = $1`,
      [input.id, input.categoryId, input.sku, input.slug, input.name, input.description, input.priceCents, input.currency, input.imageUrl, input.brand, input.stockQuantity, input.isActive],
    );

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${input.id}`);
    revalidatePath("/productos");
    redirectWithSuccess("/admin/products", "product-updated");
  } catch (error) {
    errorState(error);
    redirectWithError(productId ? `/admin/products/${productId}` : "/admin/products");
  }
}

export async function deleteProduct(formData: FormData): Promise<AdminActionState> {
  await requirePermission("catalog:write");

  try {
    const input = deleteSchema.parse({ id: formValue(formData, "id") });
    await query("DELETE FROM products WHERE id = $1", [input.id]);
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
    const input = categorySchema.parse(categoryInput(formData));

    await query(
      `INSERT INTO categories (parent_id, slug, name, image_url, display_order, position)
       VALUES ($1, $2, $3, $4, $5, $5)`,
      [input.parentId, input.slug, input.name, input.imageUrl, input.displayOrder],
    );

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
    const input = categorySchema.required({ id: true }).parse(categoryInput(formData));

    await query(
      `UPDATE categories
       SET parent_id = $2, slug = $3, name = $4, image_url = $5, display_order = $6, position = $6
       WHERE id = $1`,
      [input.id, input.parentId, input.slug, input.name, input.imageUrl, input.displayOrder],
    );

    revalidatePath("/admin/categories");
    revalidatePath(`/admin/categories/${input.id}`);
    revalidatePath("/productos");
    redirectWithSuccess("/admin/categories", "category-updated");
  } catch (error) {
    errorState(error);
    redirectWithError(categoryId ? `/admin/categories/${categoryId}` : "/admin/categories");
  }
}

export async function deleteCategory(formData: FormData): Promise<AdminActionState> {
  await requirePermission("catalog:write");

  try {
    const input = deleteSchema.parse({ id: formValue(formData, "id") });
    await query("DELETE FROM categories WHERE id = $1", [input.id]);
    revalidatePath("/admin/categories");
    revalidatePath("/productos");
    redirectWithSuccess("/admin/categories", "category-deleted");
  } catch (error) {
    errorState(error);
    redirectWithError("/admin/categories");
  }
}

export async function updateQuoteStatus(formData: FormData): Promise<AdminActionState> {
  await requirePermission("quote:write");

  try {
    const input = quoteStatusSchema.parse({ id: formValue(formData, "id"), status: formValue(formData, "status") });
    const rows = await query<QuoteStatusRow>("SELECT status FROM quote_requests WHERE id = $1", [input.id]);
    const currentStatus = rows[0]?.status;

    if (!currentStatus) {
      redirectWithError("/admin/quotes");
    }

    if (currentStatus === input.status) {
      redirectWithSuccess("/admin/quotes", "quote-updated");
    }

    if (terminalQuoteStatuses.has(currentStatus) || !quoteTransitions[currentStatus].includes(input.status)) {
      redirectWithError("/admin/quotes");
    }

    await query("UPDATE quote_requests SET status = $2 WHERE id = $1", [input.id, input.status]);
    revalidatePath("/admin/quotes");
    redirectWithSuccess("/admin/quotes", "quote-updated");
  } catch (error) {
    errorState(error);
    redirectWithError("/admin/quotes");
  }
}
