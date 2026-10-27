import type { CartItem } from "../cart-storage";

export interface ContactForm {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

export interface OrderLineInput {
  productId: string;
  quantity: number;
}

export interface OrderInput extends ContactForm {
  items: OrderLineInput[];
  expectedUnitPrices: { productId: string; unitPriceCents: number }[];
  acceptPriceRevision?: boolean;
}

export const EMPTY_FORM: ContactForm = { name: "", email: "", phone: "", notes: "" };

export function canSubmitContact(form: ContactForm): boolean {
  return form.name.trim().length >= 2 && form.email.includes("@") && form.phone.trim().length >= 7;
}

// Ids and quantities cross the wire for the write; expectedUnitPrices are only a disclosure
// snapshot of what the cart UI is showing. The server still prices from the products table.
export function buildOrderInput(
  form: ContactForm,
  items: CartItem[],
  options: { acceptPriceRevision?: boolean } = {},
): OrderInput {
  return {
    name: form.name,
    email: form.email,
    phone: form.phone,
    notes: form.notes,
    items: items.map((item) => ({ productId: item.id, quantity: item.quantity })),
    expectedUnitPrices: items.map((item) => ({ productId: item.id, unitPriceCents: item.priceCents })),
    acceptPriceRevision: options.acceptPriceRevision,
  };
}
