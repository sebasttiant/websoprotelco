"use client";

import Link from "next/link";
import { CheckCircle2, MessageCircle, Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// Imported from ./actions rather than the domain barrel on purpose. The barrel re-exports the
// service, which reaches the repository and its `import "server-only"` — pulling that whole
// graph into a client bundle is exactly what server-only exists to stop, and the build fails.
// ./actions carries "use server", so Next replaces these with RPC references and ships none of
// the implementation to the browser.
import { submitCartOrder, type CartOrderActionState } from "@/domains/quote-order/actions";
import { Portal } from "@/components/ui/portal";

import {
  calculateCartTotal,
  CART_CURRENCIES,
  CART_QUANTITY_LIMIT,
  cartChangedEventName,
  readCart,
  type CartItem,
  validateQuantity,
  writeCart,
} from "./cart-storage";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  /** From settings.whatsapp_number. Empty when unset, which hides the WhatsApp path entirely. */
  whatsappNumber: string;
}

type Step = "cart" | "form" | "done";

interface ContactForm {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

const EMPTY_FORM: ContactForm = { name: "", email: "", phone: "", notes: "" };

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: CART_CURRENCIES.COP,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

// wa.me accepts digits only — no plus sign, spaces or dashes.
function toWaNumber(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function CartDrawer({ open, onClose, whatsappNumber }: CartDrawerProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [step, setStep] = useState<Step>("cart");
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<{ reference: string; totalCents: number } | null>(null);
  const [whatsappHref, setWhatsappHref] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const sync = () => setItems(readCart());
    sync();
    window.addEventListener(cartChangedEventName(), sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(cartChangedEventName(), sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Escape closes the panel, and focus moves into it on open. A slide-over that traps neither
  // key nor focus is unusable with a keyboard and invisible to a screen reader.
  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // The page behind a modal must not scroll away under it.
  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const updateQuantity = useCallback((id: string, rawValue: string) => {
    const result = validateQuantity(Number(rawValue));
    if (!result.valid) {
      setError(result.message);
      return;
    }

    setError("");
    setItems((current) => {
      const next = current.map((item) => (item.id === id ? { ...item, quantity: result.quantity } : item));
      writeCart(next);
      return next;
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((current) => {
      const next = current.filter((item) => item.id !== id);
      writeCart(next);
      return next;
    });
  }, []);

  const total = calculateCartTotal(items);

  async function confirm(channel: "whatsapp" | "email"): Promise<void> {
    setPending(true);
    setError("");

    // Only ids and quantities cross the wire. The server reads every price from the products
    // table, so nothing the browser could tamper with reaches the recorded total.
    const state: CartOrderActionState = await submitCartOrder({
      name: form.name,
      email: form.email,
      phone: form.phone,
      notes: form.notes,
      items: items.map((item) => ({ productId: item.id, quantity: item.quantity })),
    });

    setPending(false);

    if (!state.success) {
      setError(state.message);
      return;
    }

    // The order is recorded; the cart has done its job. WhatsApp is an extra channel offered
    // as a link on the confirmation, never a precondition for the order existing.
    writeCart([]);
    setItems([]);
    setConfirmed({ reference: state.reference, totalCents: state.totalCents });
    setStep("done");

    if (channel === "whatsapp") {
      setWhatsappHref(buildWhatsappHref(state.reference, state.totalCents));
    } else {
      setWhatsappHref("");
    }
  }

  function buildWhatsappHref(reference: string, totalCents: number): string {
    const number = toWaNumber(whatsappNumber);
    if (!number) return "";

    const message = `Hola, acabo de confirmar el pedido ${reference} por ${formatCurrency(totalCents)}. Quedo atento para coordinar pago y entrega.`;
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  function reset(): void {
    setStep("cart");
    setForm(EMPTY_FORM);
    setConfirmed(null);
    setWhatsappHref("");
    setError("");
    onClose();
  }

  const canSubmit = form.name.trim().length >= 2 && form.email.includes("@") && form.phone.trim().length >= 7;
  const hasWhatsapp = toWaNumber(whatsappNumber) !== "";

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
        <header className="flex items-center justify-between border-b border-brand-line px-6 py-5">
          <h2 className="text-xl font-black text-brand-navy">Tu pedido</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar el pedido"
            className="rounded-full p-2 text-brand-muted transition hover:bg-brand-ice hover:text-brand-navy"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <p role="alert" className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </p>
          ) : null}

          {step === "done" && confirmed ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <CheckCircle2 aria-hidden="true" className="h-16 w-16 text-emerald-500" />
              <h3 className="mt-5 text-2xl font-black text-brand-navy">Pedido recibido</h3>
              <p className="mt-2 text-sm font-medium text-brand-muted">
                Tu referencia es <span className="font-black text-brand-navy">{confirmed.reference}</span> por{" "}
                <span className="font-black text-brand-navy">{formatCurrency(confirmed.totalCents)}</span>. Te
                contactamos para coordinar pago y entrega.
              </p>
              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-emerald-600"
                >
                  <MessageCircle aria-hidden="true" className="h-4 w-4" />
                  Abrir WhatsApp
                </a>
              ) : null}
              <button
                type="button"
                onClick={reset}
                className="mt-3 w-full rounded-full border border-brand-line px-6 py-4 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-accent"
              >
                Volver a la tienda
              </button>
            </div>
          ) : null}

          {step !== "done" && items.length === 0 ? (
            <div className="rounded-[28px] bg-brand-ice p-10 text-center">
              <p className="text-lg font-black text-brand-navy">Tu pedido está vacío.</p>
              <Link
                href="/productos"
                onClick={onClose}
                className="mt-5 inline-block rounded-full bg-brand-blue px-6 py-3 text-xs font-black uppercase tracking-widest text-white"
              >
                Ver catálogo
              </Link>
            </div>
          ) : null}

          {step === "cart" && items.length > 0 ? (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.id} className="rounded-2xl border border-brand-line p-4">
                  <p className="font-black text-brand-navy">{item.name}</p>
                  <p className="text-sm font-bold text-brand-muted">{formatCurrency(item.priceCents)} c/u</p>
                  <div className="mt-3 flex items-center gap-3">
                    <label htmlFor={`drawer-qty-${item.id}`} className="text-xs font-black uppercase tracking-widest text-brand-muted">
                      Cantidad
                    </label>
                    <input
                      id={`drawer-qty-${item.id}`}
                      type="number"
                      min="1"
                      max={CART_QUANTITY_LIMIT}
                      step="1"
                      value={item.quantity}
                      onChange={(event) => updateQuantity(item.id, event.target.value)}
                      className="w-20 rounded-xl border border-brand-line px-3 py-2 text-center font-black text-brand-navy"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Quitar ${item.name} del pedido`}
                      className="ml-auto inline-flex items-center gap-1.5 text-sm font-black text-brand-blue hover:underline"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {step === "form" ? (
            <div className="space-y-4">
              {(
                [
                  { key: "name", label: "Nombre", type: "text", placeholder: "Juan Pérez" },
                  { key: "email", label: "Correo", type: "email", placeholder: "juan@ejemplo.com" },
                  { key: "phone", label: "Teléfono", type: "tel", placeholder: "300 123 4567" },
                ] as const
              ).map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label htmlFor={`drawer-${key}`} className="text-xs font-black uppercase tracking-widest text-brand-muted">
                    {label}
                  </label>
                  <input
                    id={`drawer-${key}`}
                    type={type}
                    required
                    autoComplete={key === "name" ? "name" : key === "email" ? "email" : "tel"}
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                    className="mt-1.5 w-full rounded-2xl border border-brand-line px-4 py-3 font-bold text-brand-navy"
                  />
                </div>
              ))}
              <div>
                <label htmlFor="drawer-notes" className="text-xs font-black uppercase tracking-widest text-brand-muted">
                  Notas (opcional)
                </label>
                <textarea
                  id="drawer-notes"
                  rows={3}
                  placeholder="Dirección, observaciones…"
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  className="mt-1.5 w-full rounded-2xl border border-brand-line px-4 py-3 font-bold text-brand-navy"
                />
              </div>
            </div>
          ) : null}
        </div>

        {step !== "done" && items.length > 0 ? (
          <footer className="border-t border-brand-line px-6 py-5">
            <div className="flex items-center justify-between">
              <span className="text-lg font-black text-brand-navy">Subtotal</span>
              {total.valid ? (
                <output className="text-lg font-black text-brand-navy">{formatCurrency(total.totalCents)}</output>
              ) : (
                <span role="alert" className="text-xs font-bold text-brand-blue">
                  {total.message}
                </span>
              )}
            </div>

            {step === "cart" ? (
              <button
                type="button"
                onClick={() => setStep("form")}
                disabled={!total.valid}
                className="mt-4 w-full rounded-full bg-brand-blue px-6 py-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continuar con mis datos
              </button>
            ) : (
              <div className="mt-4 space-y-3">
                {hasWhatsapp ? (
                  <button
                    type="button"
                    onClick={() => confirm("whatsapp")}
                    disabled={!canSubmit || pending || !total.valid}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-blue px-6 py-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <MessageCircle aria-hidden="true" className="h-4 w-4" />
                    {pending ? "Confirmando…" : "Confirmar pedido por WhatsApp"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => confirm("email")}
                  disabled={!canSubmit || pending || !total.valid}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-blue px-6 py-4 text-xs font-black uppercase tracking-widest text-brand-blue transition hover:bg-brand-ice disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send aria-hidden="true" className="h-4 w-4" />
                  {pending ? "Confirmando…" : "Confirmar pedido por correo"}
                </button>
              </div>
            )}

            <p className="mt-4 text-center text-xs font-medium text-brand-muted">
              No se cobra en línea. Te contactaremos para coordinar pago y entrega.
            </p>
          </footer>
        ) : null}
      </aside>
    </Portal>
  );
}
