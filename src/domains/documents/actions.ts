"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { z } from "zod";

import { requirePermission } from "@/server/auth/guards";

import { documentCreateInputSchema, documentDeleteInputSchema } from "./schemas";
import * as documentsService from "./service";

export interface DocumentsActionState {
  success: boolean;
  message: string;
}

function formValue(formData: FormData, key: string): FormDataEntryValue | null {
  return formData.get(key);
}

function stringValue(formData: FormData, key: string): string {
  const value = formValue(formData, key);
  return typeof value === "string" ? value : "";
}

// Returns `undefined` (not `""`) for a missing/blank field so Zod's `.optional()` skips
// coercion entirely — e.g. an absent `fileSize` must reach the repository as `undefined`,
// not `0` from `z.coerce.number()` coercing an empty string.
function optionalStringValue(formData: FormData, key: string): string | undefined {
  const value = formValue(formData, key);
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function errorState(error: unknown): DocumentsActionState {
  if (isRedirectError(error)) {
    throw error;
  }

  if (error instanceof z.ZodError) {
    return { success: false, message: error.issues[0]?.message ?? "Invalid input." };
  }

  console.error("Documents action failed:", error);
  return { success: false, message: "The operation could not be completed." };
}

// Requires the "documents:write" permission, which both admin and staff hold per the RBAC
// matrix. The check runs before any parsing or DB work.
export async function createDocument(formData: FormData): Promise<DocumentsActionState> {
  const user = await requirePermission("documents:write");

  try {
    const input = documentCreateInputSchema.parse({
      title: formValue(formData, "title"),
      description: optionalStringValue(formData, "description"),
      filePath: formValue(formData, "filePath"),
      fileName: formValue(formData, "fileName"),
      fileSize: optionalStringValue(formData, "fileSize"),
      category: formValue(formData, "category"),
      productId: stringValue(formData, "productId"),
    });

    await documentsService.createDocument(input, user.id);
    revalidatePath("/admin/documents");
    redirect("/admin/documents?success=document-created");
  } catch (error) {
    return errorState(error);
  }
}

export async function deleteDocument(formData: FormData): Promise<DocumentsActionState> {
  await requirePermission("documents:write");

  try {
    const input = documentDeleteInputSchema.parse({
      id: formValue(formData, "id"),
    });

    await documentsService.deleteDocument(input.id);
    revalidatePath("/admin/documents");
    redirect("/admin/documents?success=document-deleted");
  } catch (error) {
    return errorState(error);
  }
}
