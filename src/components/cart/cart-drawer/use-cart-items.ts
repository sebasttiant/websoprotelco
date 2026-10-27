import { useEffect, useState } from "react";

import { cartChangedEventName, readCart, type CartItem, validateQuantity, writeCart } from "../cart-storage";

interface CartItems {
  items: CartItem[];
  /** Returns the validation message when the quantity is rejected, otherwise an empty string. */
  changeQuantity: (id: string, rawValue: string) => string;
  removeItem: (id: string) => void;
  clear: () => void;
  /** Aligns local unit prices with a server-priced snapshot after a disclosure. */
  applyServerPrices: (lines: readonly { productId: string; unitPriceCents: number }[]) => void;
}

/** The persisted cart, kept in step with changes made elsewhere on the page or in other tabs. */
export function useCartItems(): CartItems {
  const [items, setItems] = useState<CartItem[]>([]);

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

  function changeQuantity(id: string, rawValue: string): string {
    const result = validateQuantity(Number(rawValue));
    if (!result.valid) return result.message;

    setItems((current) => {
      const next = current.map((item) => (item.id === id ? { ...item, quantity: result.quantity } : item));
      writeCart(next);
      return next;
    });
    return "";
  }

  function removeItem(id: string): void {
    setItems((current) => {
      const next = current.filter((item) => item.id !== id);
      writeCart(next);
      return next;
    });
  }

  function clear(): void {
    writeCart([]);
    setItems([]);
  }

  function applyServerPrices(lines: readonly { productId: string; unitPriceCents: number }[]): void {
    const byId = new Map(lines.map((line) => [line.productId, line.unitPriceCents]));
    setItems((current) => {
      const next = current.map((item) => {
        const unitPriceCents = byId.get(item.id);
        return unitPriceCents === undefined ? item : { ...item, priceCents: unitPriceCents };
      });
      writeCart(next);
      return next;
    });
  }

  return { items, changeQuantity, removeItem, clear, applyServerPrices };
}
