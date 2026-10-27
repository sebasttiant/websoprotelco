"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { z } from "zod";

import { requirePermission, requireSession } from "@/server/auth/guards";

import {
  adminCreateUserInputSchema,
  adminDeleteUserInputSchema,
  adminUpdateUserInputSchema,
  passwordChangeInputSchema,
  profileUpdateInputSchema,
} from "./schemas";
import * as usersService from "./service";

export interface AccountActionState {
  success: boolean;
  message: string;
}

export type CreateUserActionState =
  | { success: true; message: string }
  | { success: false; message: string };

export type ManageUserActionState =
  | { success: true; message: string }
  | { success: false; message: string };

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

// Admin-only user creation. requirePermission("admin:access") runs BEFORE anything is parsed,
// so a caller without that permission can never reach the role-assigning path — this is the
// gate that separates it from the public signUp, which can only ever mint a customer.
//
// Returns state instead of redirecting: the modal stays open to report a taken email inline,
// then the client refreshes the list on success.
export async function createUser(input: unknown): Promise<CreateUserActionState> {
  await requirePermission("admin:access");

  const parsed = adminCreateUserInputSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  try {
    const outcome = await usersService.createUser(parsed.data);

    if (outcome.status === "email-taken") {
      return { success: false, message: "Ese correo ya está registrado." };
    }

    revalidatePath("/admin/users");
    return { success: true, message: "Usuario creado." };
  } catch (error) {
    console.error("Admin user creation failed:", error);
    return { success: false, message: "No se pudo crear el usuario." };
  }
}

// Admin-only user update. Actor id comes from the session so self-lockout and last-admin
// guards cannot be bypassed by forging a different actor in the payload.
export async function updateUser(input: unknown): Promise<ManageUserActionState> {
  const actor = await requirePermission("admin:access");

  const parsed = adminUpdateUserInputSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  try {
    const outcome = await usersService.updateUser(actor.id, parsed.data);

    if (outcome.status === "email-taken") {
      return { success: false, message: "Ese correo ya está registrado." };
    }
    if (outcome.status === "not-found") {
      return { success: false, message: "No encontramos ese usuario." };
    }
    if (outcome.status === "forbidden-self") {
      return {
        success: false,
        message: "No podés desactivar ni quitarte el rol de administrador a vos mismo.",
      };
    }
    if (outcome.status === "forbidden-last-admin") {
      return {
        success: false,
        message: "Tiene que quedar al menos un administrador activo.",
      };
    }

    revalidatePath("/admin/users");
    return { success: true, message: "Usuario actualizado." };
  } catch (error) {
    console.error("Admin user update failed:", error);
    return { success: false, message: "No se pudo actualizar el usuario." };
  }
}

// Admin-only hard delete. Same session-bound actor and last-admin guards as updateUser.
export async function deleteUser(input: unknown): Promise<ManageUserActionState> {
  const actor = await requirePermission("admin:access");

  const parsed = adminDeleteUserInputSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "Usuario inválido." };
  }

  try {
    const outcome = await usersService.deleteUser(actor.id, parsed.data);

    if (outcome.status === "not-found") {
      return { success: false, message: "No encontramos ese usuario." };
    }
    if (outcome.status === "forbidden-self") {
      return { success: false, message: "No podés eliminarte a vos mismo." };
    }
    if (outcome.status === "forbidden-last-admin") {
      return {
        success: false,
        message: "Tiene que quedar al menos un administrador activo.",
      };
    }

    revalidatePath("/admin/users");
    return { success: true, message: "Usuario eliminado." };
  } catch (error) {
    console.error("Admin user deletion failed:", error);
    return { success: false, message: "No se pudo eliminar el usuario." };
  }
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
