"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { z } from "zod";

import { requirePermission } from "@/server/auth/guards";

import { catalogDeleteInputSchema, categoryAdminInputSchema, productAdminInputSchema } from "./schemas";
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
    const input = productAdminInputSchema.required({ id: true }).parse(productInput(formData));

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
    const input = categoryAdminInputSchema.required({ id: true }).parse(categoryInput(formData));

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
