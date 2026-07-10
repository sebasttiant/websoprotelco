"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { z } from "zod";

import { requireSession } from "@/server/auth/guards";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { query } from "@/server/db/pool";

export interface AccountActionState {
  success: boolean;
  message: string;
}

const profileSchema = z.object({
  name: z.string().trim().min(2, { error: "Name is required." }).max(160),
  email: z.email({ error: "A valid email is required." }).trim().toLowerCase(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, { error: "Current password is required." }),
  newPassword: z.string().min(12, { error: "New password must be at least 12 characters." }).max(200),
  confirmPassword: z.string().min(1, { error: "Password confirmation is required." }),
}).superRefine((value, ctx) => {
  if (value.newPassword !== value.confirmPassword) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmPassword"], message: "Passwords do not match." });
  }
});

interface PasswordRow {
  password_hash: string | null;
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

export async function updateProfile(formData: FormData): Promise<AccountActionState> {
  const user = await requireSession();

  try {
    const input = profileSchema.parse({
      name: stringValue(formData, "name"),
      email: stringValue(formData, "email"),
    });

    await query("UPDATE users SET full_name = $2, email = $3 WHERE id = $1", [user.id, input.name, input.email]);
    revalidatePath("/cuenta");
    revalidatePath("/cuenta/perfil");
    redirect("/cuenta?success=profile-updated");
  } catch (error) {
    return accountErrorState(error);
  }
}

export async function changePassword(formData: FormData): Promise<AccountActionState> {
  const user = await requireSession();

  try {
    const input = passwordSchema.parse({
      currentPassword: stringValue(formData, "currentPassword"),
      newPassword: stringValue(formData, "newPassword"),
      confirmPassword: stringValue(formData, "confirmPassword"),
    });

    const rows = await query<PasswordRow>("SELECT password_hash FROM users WHERE id = $1 LIMIT 1", [user.id]);
    const storedHash = rows[0]?.password_hash;

    if (!storedHash || !(await verifyPassword(input.currentPassword, storedHash))) {
      return { success: false, message: "Current password is incorrect." };
    }

    const newHash = await hashPassword(input.newPassword);
    await query("UPDATE users SET password_hash = $2 WHERE id = $1", [user.id, newHash]);
    revalidatePath("/cuenta");
    redirect("/cuenta?success=password-updated");
  } catch (error) {
    return accountErrorState(error);
  }
}
