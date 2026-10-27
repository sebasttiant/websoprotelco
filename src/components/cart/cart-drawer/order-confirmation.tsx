import { CheckCircle2, MessageCircle } from "lucide-react";

import { formatCurrency } from "./format";
import type { ConfirmedOrder } from "./types";

interface OrderConfirmationProps {
  order: ConfirmedOrder;
  /** Empty when the order was confirmed by email or the shop has no WhatsApp number. */
  whatsappHref: string;
  onReset: () => void;
}

export function OrderConfirmation({ order, whatsappHref, onReset }: OrderConfirmationProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <CheckCircle2 aria-hidden="true" className="h-16 w-16 text-emerald-500" />
      <h3 className="mt-5 text-2xl font-black text-brand-navy">Pedido recibido</h3>
      <p className="mt-2 text-sm font-medium text-brand-muted">
        Tu referencia es <span className="font-black text-brand-navy">{order.reference}</span> por{" "}
        <span className="font-black text-brand-navy">{formatCurrency(order.totalCents)}</span>. Ya
        registramos el pedido y enviamos una copia estructurada al correo operativo.
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
        onClick={onReset}
        className="mt-3 w-full rounded-full border border-brand-line px-6 py-4 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-accent"
      >
        Volver a la tienda
      </button>
    </div>
  );
}
