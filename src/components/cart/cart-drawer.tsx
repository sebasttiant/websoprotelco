"use client";

import { useState } from "react";

// Imported from ./actions rather than the domain barrel on purpose. The barrel re-exports the
// service, which reaches the repository and its `import "server-only"` — pulling that whole
// graph into a client bundle is exactly what server-only exists to stop, and the build fails.
// ./actions carries "use server", so Next replaces these with RPC references and ships none of
// the implementation to the browser.
import { submitCartOrder, type CartOrderActionState } from "@/domains/quote-order/actions";
import { Portal } from "@/components/ui/portal";

import { calculateCartTotal } from "./cart-storage";
import { CartLines } from "./cart-drawer/cart-lines";
import { buildOrderInput, canSubmitContact, type ContactForm, EMPTY_FORM } from "./cart-drawer/contact";
import { ContactFields } from "./cart-drawer/contact-fields";
import { DrawerFooter } from "./cart-drawer/drawer-footer";
import { DrawerHeader } from "./cart-drawer/drawer-header";
import { EmptyCart } from "./cart-drawer/empty-cart";
import { OrderConfirmation } from "./cart-drawer/order-confirmation";
import type { ConfirmedOrder, Step } from "./cart-drawer/types";
import { useCartItems } from "./cart-drawer/use-cart-items";
import { useDrawerBehavior } from "./cart-drawer/use-drawer-behavior";
import { buildWhatsappHref, toWaNumber } from "./cart-drawer/whatsapp";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  /** From settings.whatsapp_number. Empty when unset, which hides the WhatsApp path entirely. */
  whatsappNumber: string;
}

export function CartDrawer({ open, onClose, whatsappNumber }: CartDrawerProps) {
  const { items, changeQuantity, removeItem, clear } = useCartItems();
  const [step, setStep] = useState<Step>("cart");
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<ConfirmedOrder | null>(null);
  const [whatsappHref, setWhatsappHref] = useState("");
  const closeButtonRef = useDrawerBehavior(open, onClose);

  const total = calculateCartTotal(items);

  async function confirm(channel: "whatsapp" | "email"): Promise<void> {
    setPending(true);
    setError("");

    const state: CartOrderActionState = await submitCartOrder(buildOrderInput(form, items));

    setPending(false);

    if (!state.success) {
      setError(state.message);
      return;
    }

    // The order is recorded; the cart has done its job. WhatsApp is an extra channel offered
    // as a link on the confirmation, never a precondition for the order existing.
    clear();
    setConfirmed({ reference: state.reference, totalCents: state.totalCents });
    setStep("done");

    if (channel === "whatsapp") {
      setWhatsappHref(buildWhatsappHref(whatsappNumber, state.reference, state.totalCents));
    } else {
      setWhatsappHref("");
    }
  }

  function reset(): void {
    setStep("cart");
    setForm(EMPTY_FORM);
    setConfirmed(null);
    setWhatsappHref("");
    setError("");
    onClose();
  }

  // Portalled to document.body: this component is rendered from the header, which carries
  // `backdrop-blur-xl` and therefore becomes the containing block for any fixed descendant.
  // Left in place, the panel is sized against the header rather than the viewport.
  return (
    <Portal>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-[100] bg-brand-navy/40 backdrop-blur-sm transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Tu pedido"
        aria-hidden={!open}
        // h-dvh, not h-full: h-full is 100% of the containing block, which only equals the
        // window because of the Portal above — and on mobile browsers the dynamic viewport unit
        // is what accounts for the collapsing address bar.
        className={`fixed right-0 top-0 z-[101] flex h-dvh w-full max-w-[26rem] flex-col bg-white shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
      >
        <DrawerHeader ref={closeButtonRef} onClose={onClose} />

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <p role="alert" className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </p>
          ) : null}

          {step === "done" && confirmed ? (
            <OrderConfirmation order={confirmed} whatsappHref={whatsappHref} onReset={reset} />
          ) : null}

          {step !== "done" && items.length === 0 ? <EmptyCart onClose={onClose} /> : null}

          {step === "cart" && items.length > 0 ? (
            <CartLines
              items={items}
              onQuantityChange={(id, rawValue) => setError(changeQuantity(id, rawValue))}
              onRemove={removeItem}
            />
          ) : null}

          {step === "form" ? (
            <ContactFields form={form} onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))} />
          ) : null}
        </div>

        {step !== "done" && items.length > 0 ? (
          <DrawerFooter
            step={step}
            total={total}
            canSubmit={canSubmitContact(form)}
            pending={pending}
            hasWhatsapp={toWaNumber(whatsappNumber) !== ""}
            onContinue={() => setStep("form")}
            onConfirm={confirm}
          />
        ) : null}
      </aside>
    </Portal>
  );
}
