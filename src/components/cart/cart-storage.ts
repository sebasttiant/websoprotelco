import { z } from "zod";

export const CART_QUANTITY_LIMIT = 99;
export const CART_CURRENCIES = {
  COP: "COP",
} as const;

const CART_STORAGE_KEY = "soprotelco_quote_cart";
const CART_CHANGED_EVENT = "soprotelco-cart-changed";

const cartItemSchema = z.object({
  id: z.uuid(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(160),
  priceCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  currency: z.literal(CART_CURRENCIES.COP),
  quantity: z.number().int().positive(),
}).strict();

export type CartItem = z.infer<typeof cartItemSchema>;
export type CartItemInput = Omit<CartItem, "quantity">;

export type QuantityResult =
  | { valid: true; quantity: number; normalized: boolean }
  | { valid: false; message: string };

export function validateQuantity(value: number): QuantityResult {
  if (!Number.isInteger(value) || value <= 0) {
    return { valid: false, message: "La cantidad debe ser un número entero mayor que cero." };
  }

  return {
    valid: true,
    quantity: Math.min(value, CART_QUANTITY_LIMIT),
    normalized: value > CART_QUANTITY_LIMIT,
  };
}

export type CartTotalResult =
  | { valid: true; totalCents: number }
  | { valid: false; message: string };

// `priceCents` is bounded by MAX_SAFE_INTEGER individually, but a line total (price ×
// quantity) or the running sum can still leave the safe range, where IEEE-754 rounds
// silently. A wrong quote total is worse than no total, so this fails closed instead.
export function calculateCartTotal(items: CartItem[]): CartTotalResult {
  const unrepresentable: CartTotalResult = {
    valid: false,
    message: "No podemos calcular el total de esta selección. Quitá productos o reducí las cantidades.",
  };

  let totalCents = 0;

  for (const item of items) {
    const lineCents = item.priceCents * item.quantity;
    if (!Number.isSafeInteger(lineCents)) return unrepresentable;

    totalCents += lineCents;
    if (!Number.isSafeInteger(totalCents)) return unrepresentable;
  }

  return { valid: true, totalCents };
}

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];

  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];

    return stored.flatMap((item) => {
      const parsed = cartItemSchema.safeParse(item);
      if (!parsed.success) return [];

      return [{ ...parsed.data, quantity: Math.min(parsed.data.quantity, CART_QUANTITY_LIMIT) }];
    });
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]): void {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CART_CHANGED_EVENT));
}

export function addCartItem(item: CartItemInput): QuantityResult {
  if (!cartItemSchema.omit({ quantity: true }).safeParse(item).success) {
    return { valid: false, message: "El producto no se puede agregar al carrito." };
  }

  const items = readCart();
  const existing = items.find((candidate) => candidate.id === item.id);
  const result = validateQuantity((existing?.quantity ?? 0) + 1);
  if (!result.valid) return result;

  writeCart(existing
    ? items.map((candidate) => candidate.id === item.id ? { ...candidate, quantity: result.quantity } : candidate)
    : [...items, { ...item, quantity: result.quantity }]);
  return result;
}

export function cartChangedEventName(): string {
  return CART_CHANGED_EVENT;
}
