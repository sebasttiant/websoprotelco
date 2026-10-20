import { formatCurrency } from "./format";

// wa.me accepts digits only — no plus sign, spaces or dashes.
export function toWaNumber(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Empty when the shop has no usable WhatsApp number, which hides the link. */
export function buildWhatsappHref(whatsappNumber: string, reference: string, totalCents: number): string {
  const number = toWaNumber(whatsappNumber);
  if (!number) return "";

  const message = `Hola, acabo de confirmar el pedido ${reference} por ${formatCurrency(totalCents)}. Quedo atento para coordinar pago y entrega.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
