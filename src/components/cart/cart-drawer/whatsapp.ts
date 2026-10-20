import type { CartItem } from "../cart-storage";
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
  items: readonly CartItem[],
): string {
  const number = toWaNumber(whatsappNumber);
  if (!number) return "";

  const lines = items.map(
    (item) => `${item.quantity} × ${item.name} — ${formatCurrency(item.priceCents * item.quantity)}`,
  );
  const message = [
    `Hola, confirmo mi pedido ${reference}:`,
    ...lines,
    `Total: ${formatCurrency(totalCents)}`,
    "Quedo atento para coordinar pago y entrega.",
  ].join("\n");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
