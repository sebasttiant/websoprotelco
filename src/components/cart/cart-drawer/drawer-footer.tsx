import { MessageCircle, Send } from "lucide-react";

import type { CartTotalResult } from "../cart-storage";
import { formatCurrency } from "./format";
import type { Step } from "./types";

interface DrawerFooterProps {
  /** The footer only exists while ordering, so the confirmation step is excluded. */
  step: Exclude<Step, "done">;
  total: CartTotalResult;
  canSubmit: boolean;
  pending: boolean;
  hasWhatsapp: boolean;
  onContinue: () => void;
  onConfirm: (channel: "whatsapp" | "email") => void;
}

export function DrawerFooter({ step, total, canSubmit, pending, hasWhatsapp, onContinue, onConfirm }: DrawerFooterProps) {
  const confirmDisabled = !canSubmit || pending || !total.valid;

  return (
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
          onClick={onContinue}
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
              onClick={() => onConfirm("whatsapp")}
              disabled={confirmDisabled}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-blue px-6 py-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessageCircle aria-hidden="true" className="h-4 w-4" />
              {pending ? "Confirmando…" : "Confirmar pedido por WhatsApp"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onConfirm("email")}
            disabled={confirmDisabled}
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
  );
}
