"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { z } from "zod";

import { requireSession } from "@/server/auth/guards";

import { passwordChangeInputSchema, profileUpdateInputSchema } from "./schemas";
import * as usersService from "./service";

export interface AccountActionState {
  success: boolean;
  message: string;
}

function stringValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);

  return typeof value === "string" ? value : undefined;
}

function accountErrorState(error: unknown): AccountActionState {
  if (isRedirectError(error)) {
    throw error;
  }

  if (error instanceof z.ZodError) {
    return { success: false, message: error.issues[0]?.message ?? "Invalid input." };
  }

  console.error("Account action failed:", error);
  return { success: false, message: "The operation could not be completed." };
}

// Customer self-service. The target user id is taken from the server session as
// the FIRST statement, never from the form, so a caller cannot update another
// user's profile by smuggling an "id" field into the request.
export async function updateProfile(formData: FormData): Promise<AccountActionState> {
  const user = await requireSession();

  try {
    const input = profileUpdateInputSchema.parse({
      name: stringValue(formData, "name"),
    });

    await usersService.updateProfile(user.id, input);
    revalidatePath("/cuenta");
    revalidatePath("/cuenta/perfil");
    redirect("/cuenta?success=profile-updated");
  } catch (error) {
    return accountErrorState(error);
  }
}

// Customer self-service. Scoped to the session user's own id, and the service
// re-verifies the current password before any new hash is written.
export async function changePassword(formData: FormData): Promise<AccountActionState> {
  const user = await requireSession();

  try {
    const input = passwordChangeInputSchema.parse({
      currentPassword: stringValue(formData, "currentPassword"),
      newPassword: stringValue(formData, "newPassword"),
      confirmPassword: stringValue(formData, "confirmPassword"),
    });

    const outcome = await usersService.changePassword(user.id, input);

    if (outcome === "invalid-current-password") {
      return { success: false, message: "Current password is incorrect." };
    }

    revalidatePath("/cuenta");
    redirect("/cuenta?success=password-updated");
  } catch (error) {
    return accountErrorState(error);
  }
}
