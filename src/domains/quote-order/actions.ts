"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { z } from "zod";

import { getCurrentUser, requirePermission } from "@/server/auth/guards";

import { PriceChangedError, UnavailableProductError } from "./repository";
import {
  cartOrderInputSchema,
  contactRequestInputSchema,
  quoteStatusUpdateInputSchema,
  type PricedOrderLine,
} from "./schemas";
import * as quoteOrderService from "./service";

export interface AdminActionState {
  success: boolean;
  message: string;
}

export type CartOrderActionState =
  | { success: true; reference: string; totalCents: number; lines: PricedOrderLine[] }
  | {
      success: false;
      code: "price-changed";
      message: string;
      totalCents: number;
      lines: PricedOrderLine[];
    }
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

export type ContactMessageActionState = { success: true } | { success: false; message: string };

// Public entry point behind the "/contacto" composer. Reachable by guests; returns state so
// the client can still open WhatsApp after the structured mailbox notification is queued.
export async function submitContactMessage(input: unknown): Promise<ContactMessageActionState> {
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const productSlug = typeof body.productSlug === "string" ? body.productSlug.trim() : "";
  const baseMessage = typeof body.message === "string" ? body.message : "";
  const message =
    productSlug !== "" ? `${baseMessage}\n\nProducto consultado: ${productSlug}` : baseMessage;

  const parsed = contactRequestInputSchema.safeParse({
    name: body.name,
    email: body.email,
    phone: body.phone,
    subject: body.subject,
    message,
  });

  if (!parsed.success) {
    return { success: false, message: "Revisá los datos del formulario e intentá de nuevo." };
  }

  try {
    const user = await getCurrentUser();
    await quoteOrderService.submitQuoteRequest(parsed.data, user?.id ?? null);
    revalidatePath("/admin/quotes");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("Contact message submission failed:", error);
    return { success: false, message: "No pudimos registrar tu mensaje. Intentá de nuevo en unos minutos." };
  }
}

// Public entry point behind the legacy "/contacto" form post. Reachable by unauthenticated visitors,
// so it must never gain a requirePermission guard.
export async function submitContactRequest(formData: FormData): Promise<void> {
  const result = await submitContactMessage({
    name: stringValue(formData, "name"),
    email: stringValue(formData, "email"),
    phone: stringValue(formData, "phone"),
    subject: stringValue(formData, "subject"),
    message: stringValue(formData, "message"),
  });

  if (!result.success) {
    redirect("/contacto?error=validation");
  }

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

  try {
    // Ownership binding, not an access check: a signed-in visitor's order is tied to their id,
    // a guest's stays NULL. Session lookup stays inside the try so a store/session failure
    // returns a handled message instead of an unhandled rejection that leaves the UI stuck.
    const user = await getCurrentUser();
    const result = await quoteOrderService.submitCartOrder(parsed.data, user?.id ?? null);

    revalidatePath("/admin/orders");
    revalidatePath("/admin");

    return {
      success: true,
      reference: result.reference,
      totalCents: result.totalCents,
      lines: result.lines,
    };
  } catch (error) {
    if (error instanceof PriceChangedError) {
      return {
        success: false,
        code: "price-changed",
        message:
          "Algunos precios del carrito cambiaron. Revisá el nuevo total y confirmá de nuevo para continuar.",
        totalCents: error.totalCents,
        lines: [...error.lines],
      };
    }

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

// Admin-side order entry, for orders taken by phone or in person.
//
// Deliberately NOT a reuse of submitCartOrder: that one binds ownership to the session user,
// which here is the staff member operating the panel, not the customer. Reusing it would file
// every phone order under whoever happened to be on shift, and those rows would then surface
// in that employee's own account history. Ownership stays NULL, exactly as for a guest.
export async function createAdminOrder(input: unknown): Promise<CartOrderActionState> {
  await requirePermission("quote:write");

  const parsed = cartOrderInputSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "Revisá los datos del cliente y los productos del pedido." };
  }

  try {
    // Admin entry never carries a stale-cart snapshot: staff price from the live catalog.
    const result = await quoteOrderService.submitCartOrder(
      {
        ...parsed.data,
        expectedUnitPrices: undefined,
        acceptPriceRevision: true,
        channelHint: "admin",
      },
      null,
    );

    revalidatePath("/admin/orders");
    revalidatePath("/admin");

    return {
      success: true,
      reference: result.reference,
      totalCents: result.totalCents,
      lines: result.lines,
    };
  } catch (error) {
    if (error instanceof UnavailableProductError) {
      return { success: false, message: "Algún producto ya no está disponible o fue desactivado." };
    }

    console.error("Admin order creation failed:", error);
    return { success: false, message: "No se pudo crear el pedido." };
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
