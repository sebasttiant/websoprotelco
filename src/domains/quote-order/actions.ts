"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { z } from "zod";

import { getCurrentUser, requirePermission } from "@/server/auth/guards";

import { contactRequestInputSchema, quoteStatusUpdateInputSchema } from "./schemas";
import * as quoteOrderService from "./service";

export interface AdminActionState {
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

function errorState(error: unknown): AdminActionState {
  if (isRedirectError(error)) {
    throw error;
  }

  if (error instanceof z.ZodError) {
    return { success: false, message: error.issues[0]?.message ?? "Invalid input." };
  }

  console.error("Quote order action failed:", error);
  return { success: false, message: "The operation could not be completed." };
}

function redirectWithSuccess(pathname: string, code: string): never {
  redirect(`${pathname}?success=${code}`);
}

function redirectWithError(pathname: string, code = "action-failed"): never {
  redirect(`${pathname}?error=${code}`);
}

// Public entry point behind the "/contacto" form. Reachable by unauthenticated visitors,
// so it must never gain a requirePermission guard.
export async function submitContactRequest(formData: FormData): Promise<void> {
  const parsed = contactRequestInputSchema.safeParse({
    name: stringValue(formData, "name"),
    email: stringValue(formData, "email"),
    phone: stringValue(formData, "phone"),
    subject: stringValue(formData, "subject"),
    message: stringValue(formData, "message"),
  });

  if (!parsed.success) {
    redirect("/contacto?error=validation");
  }

  // Resolve the session WITHOUT guarding: getCurrentUser returns null for guests, so
  // unauthenticated visitors are never rejected. This is ownership binding, not an
  // access check — an authenticated submission is tied to the session user's id, a
  // guest submission stays NULL.
  const user = await getCurrentUser();

  await quoteOrderService.submitQuoteRequest(parsed.data, user?.id ?? null);

  redirect("/contacto?sent=1");
}

// Admin-only triage mutation: requires the "quote:write" permission before touching
// anything else, including reading the quote's current status.
export async function updateQuoteStatus(formData: FormData): Promise<AdminActionState> {
  await requirePermission("quote:write");

  try {
    const input = quoteStatusUpdateInputSchema.parse({
      id: formValue(formData, "id"),
      status: formValue(formData, "status"),
    });

    const outcome = await quoteOrderService.updateQuoteStatus(input);

    if (outcome === "not-found" || outcome === "invalid-transition") {
      redirectWithError("/admin/quotes");
    }

    if (outcome === "updated") {
      revalidatePath("/admin/quotes");
    }

    redirectWithSuccess("/admin/quotes", "quote-updated");
  } catch (error) {
    errorState(error);
    redirectWithError("/admin/quotes");
  }
}
