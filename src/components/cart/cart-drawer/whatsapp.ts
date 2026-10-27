import type { PricedOrderLine } from "@/domains/quote-order/schemas";

import { formatCurrency } from "./format";

// wa.me accepts digits only — no plus sign, spaces or dashes.
export function toWaNumber(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Empty when the shop has no usable WhatsApp number, which hides the link. */
export function buildWhatsappHref(
  whatsappNumber: string,
  reference: string,
  totalCents: number,
  lines: readonly Pick<PricedOrderLine, "name" | "quantity" | "unitPriceCents">[],
): string {
  const number = toWaNumber(whatsappNumber);
  if (!number) return "";

  // Line amounts come from the server-priced order, never from the stale cart copy.
  const messageLines = lines.map(
    (line) => `${line.quantity} × ${line.name} — ${formatCurrency(line.unitPriceCents * line.quantity)}`,
  );
  const message = [
    `Hola, confirmo mi pedido ${reference}:`,
    ...messageLines,
    `Total: ${formatCurrency(totalCents)}`,
    "Quedo atento para coordinar pago y entrega.",
  ].join("\n");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
