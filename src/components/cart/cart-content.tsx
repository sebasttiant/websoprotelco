"use client";

import Link from "next/link";
import { useState } from "react";

// Same server-action import contract as the drawer: ./actions carries "use server",
// so none of the server implementation reaches the client bundle.
import { submitCartOrder, type CartOrderActionState } from "@/domains/quote-order/actions";

import { calculateCartTotal } from "./cart-storage";
import { CartLines } from "./cart-drawer/cart-lines";
import { buildOrderInput, canSubmitContact, type ContactForm, EMPTY_FORM } from "./cart-drawer/contact";
import { ContactFields } from "./cart-drawer/contact-fields";
import { DrawerFooter } from "./cart-drawer/drawer-footer";
import { OrderConfirmation } from "./cart-drawer/order-confirmation";
import type { ConfirmedOrder } from "./cart-drawer/types";
import { useCartItems } from "./cart-drawer/use-cart-items";
import { buildWhatsappHref, toWaNumber } from "./cart-drawer/whatsapp";

interface CartContentProps {
  /** From settings.whatsapp_number. Empty when unset, which hides the WhatsApp path entirely. */
  whatsappNumber: string;
}

/**
 * Full checkout for the /carrito page: the same lines, contact form, channels and
 * server-side order recording as the header drawer, laid out as a page instead of
 * a dialog. Before this, the page only edited quantities and dead-ended into the
 * contact form, so a shopper who landed here could never place the order.
 */
export function CartContent({ whatsappNumber }: CartContentProps) {
  const { items, changeQuantity, removeItem, clear, applyServerPrices } = useCartItems();
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [acceptPriceRevision, setAcceptPriceRevision] = useState(false);
  const [confirmed, setConfirmed] = useState<ConfirmedOrder | null>(null);
  const [whatsappHref, setWhatsappHref] = useState("");

  const total = calculateCartTotal(items);

  async function confirm(channel: "whatsapp" | "email"): Promise<void> {
    setPending(true);
    setError("");

    try {
      const state: CartOrderActionState = await submitCartOrder(
        buildOrderInput(form, items, { acceptPriceRevision }),
      );

      if (!state.success) {
        if ("code" in state && state.code === "price-changed") {
          applyServerPrices(state.lines);
          setAcceptPriceRevision(true);
        }
        setError(state.message);
        return;
      }

      // The order is recorded; the cart has done its job. WhatsApp is an extra channel
      // offered as a link on the confirmation, never a precondition for the order existing.
      // Line amounts come from the server-priced result, not the stale localStorage copy.
      clear();
      setAcceptPriceRevision(false);
      setConfirmed({ reference: state.reference, totalCents: state.totalCents });
      setWhatsappHref(
        channel === "whatsapp"
          ? buildWhatsappHref(whatsappNumber, state.reference, state.totalCents, state.lines)
          : "",
      );
    } catch {
      setError("No pudimos registrar tu pedido. Intentá de nuevo en unos minutos.");
    } finally {
      setPending(false);
    }
  }

  function reset(): void {
    setForm(EMPTY_FORM);
    setConfirmed(null);
    setWhatsappHref("");
    setError("");
    setAcceptPriceRevision(false);
  }

  if (confirmed) {
    return (
      <section className="rounded-[32px] bg-white p-10 shadow-xl shadow-blue-950/5">
        <OrderConfirmation order={confirmed} whatsappHref={whatsappHref} onReset={reset} />
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="rounded-[32px] bg-white p-10 text-center shadow-xl shadow-blue-950/5">
        <h2 className="text-2xl font-black text-brand-navy">Tu carrito está vacío</h2>
        <p className="mt-3 text-brand-muted">Agrega equipos del catálogo para armar tu pedido.</p>
        <Link href="/productos" className="mt-6 inline-block rounded-full bg-brand-blue px-6 py-3 text-xs font-black uppercase tracking-widest text-white">
          Volver al catálogo
        </Link>
      </section>
    );
  }

  return (
    <section aria-label="Productos del carrito" className="rounded-[32px] bg-white p-6 shadow-xl shadow-blue-950/5 sm:p-8">
      {error ? (
        <p role="alert" className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}

      <CartLines
        items={items}
        idPrefix="page"
        onQuantityChange={(id, rawValue) => setError(changeQuantity(id, rawValue))}
        onRemove={removeItem}
      />

      <div className="mt-8 border-t border-brand-line pt-6">
        <h2 className="mb-4 text-lg font-black text-brand-navy">Datos de contacto</h2>
        <ContactFields idPrefix="page" form={form} onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))} />
      </div>

      <DrawerFooter
        step="form"
        total={total}
        canSubmit={canSubmitContact(form)}
        pending={pending}
        hasWhatsapp={toWaNumber(whatsappNumber) !== ""}
        onContinue={() => undefined}
        onConfirm={confirm}
      />
    </section>
  );
}
