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
}

export const EMPTY_FORM: ContactForm = { name: "", email: "", phone: "", notes: "" };

export function canSubmitContact(form: ContactForm): boolean {
  return form.name.trim().length >= 2 && form.email.includes("@") && form.phone.trim().length >= 7;
}

// Only ids and quantities cross the wire. The server reads every price from the products
// table, so nothing the browser could tamper with reaches the recorded total.
export function buildOrderInput(form: ContactForm, items: CartItem[]): OrderInput {
  return {
    name: form.name,
    email: form.email,
    phone: form.phone,
    notes: form.notes,
    items: items.map((item) => ({ productId: item.id, quantity: item.quantity })),
  };
}
