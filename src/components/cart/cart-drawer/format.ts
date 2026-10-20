import { CART_CURRENCIES } from "../cart-storage";

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: CART_CURRENCIES.COP,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}
