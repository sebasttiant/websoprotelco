"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { z } from "zod";

import { requirePermission } from "@/server/auth/guards";

import { stockMovementInputSchema } from "./schemas";
import * as inventoryService from "./service";

export interface InventoryActionState {
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

function errorState(error: unknown): InventoryActionState {
  if (isRedirectError(error)) {
    throw error;
  }

  if (error instanceof z.ZodError) {
    return { success: false, message: error.issues[0]?.message ?? "Invalid input." };
  }

  console.error("Inventory action failed:", error);
  return { success: false, message: "The operation could not be completed." };
}

// Requires the "inventory:write" permission, which both admin and staff hold per the RBAC
// matrix. The check runs before any parsing or DB work.
export async function recordStockMovement(formData: FormData): Promise<InventoryActionState> {
  const user = await requirePermission("inventory:write");

  try {
    const input = stockMovementInputSchema.parse({
      productId: formValue(formData, "productId"),
      movementType: formValue(formData, "movementType"),
      quantity: stringValue(formData, "quantity"),
      notes: stringValue(formData, "notes"),
    });

    await inventoryService.recordMovement(input, user.id);
    revalidatePath("/admin/inventory");
    redirect("/admin/inventory?success=movement-recorded");
  } catch (error) {
    return errorState(error);
  }
}
