"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { z } from "zod";

import { requirePermission } from "@/server/auth/guards";

import { settingUpdateInputSchema } from "./schemas";
import * as settingsService from "./service";

export interface SettingsActionState {
  success: boolean;
  message: string;
}

function stringValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);

  return typeof value === "string" ? value : undefined;
}

function errorState(error: unknown): SettingsActionState {
  if (isRedirectError(error)) {
    throw error;
  }

  if (error instanceof z.ZodError) {
    return { success: false, message: error.issues[0]?.message ?? "Invalid input." };
  }

  console.error("Settings action failed:", error);
  return { success: false, message: "The operation could not be completed." };
}

// Admin-only mutation. The permission check runs before any input parsing, so an
// unauthorized caller never reaches the update even with a well-formed payload.
export async function updateSetting(formData: FormData): Promise<SettingsActionState> {
  const user = await requirePermission("settings:write");

  try {
    const input = settingUpdateInputSchema.parse({
      key: stringValue(formData, "key"),
      value: stringValue(formData, "value"),
    });

    await settingsService.updateSetting(input, user.id);
    revalidatePath("/admin/settings");
    revalidatePath("/");
    redirect("/admin/settings?success=setting-updated");
  } catch (error) {
    return errorState(error);
  }
}
