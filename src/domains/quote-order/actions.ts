"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { z } from "zod";

import { getCurrentUser, requirePermission } from "@/server/auth/guards";

import { UnavailableProductError } from "./repository";
import { cartOrderInputSchema, contactRequestInputSchema, quoteStatusUpdateInputSchema } from "./schemas";
import * as quoteOrderService from "./service";

export interface AdminActionState {
  success: boolean;
  message: string;
}

export type CartOrderActionState =
  | { success: true; reference: string; totalCents: number }
  | { success: false; message: string };

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

// Public checkout behind the cart drawer. Like submitContactRequest, it is reachable by
// unauthenticated visitors and must never gain a requirePermission guard.
//
// It returns state instead of redirecting: the drawer stays open to show the reference and,
// for the WhatsApp path, a link the visitor clicks themselves. Opening a window from inside an
// awaited callback is what popup blockers exist to stop, so the order is never left created
// with the customer looking at nothing.
export async function submitCartOrder(input: unknown): Promise<CartOrderActionState> {
  const parsed = cartOrderInputSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "Revisá los datos de contacto y los productos del pedido." };
  }

  // Ownership binding, not an access check: a signed-in visitor's order is tied to their id,
  // a guest's stays NULL.
  const user = await getCurrentUser();

  try {
    const result = await quoteOrderService.submitCartOrder(parsed.data, user?.id ?? null);

    revalidatePath("/admin/orders");
    revalidatePath("/admin");

    return { success: true, reference: result.reference, totalCents: result.totalCents };
  } catch (error) {
    if (error instanceof UnavailableProductError) {
      return {
        success: false,
        message: "Algún producto ya no está disponible. Actualizá tu pedido e intentá de nuevo.",
      };
    }

    console.error("Cart order submission failed:", error);
    return { success: false, message: "No pudimos registrar tu pedido. Intentá de nuevo en unos minutos." };
  }
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
