import { Trash2 } from "lucide-react";

import { CART_QUANTITY_LIMIT, type CartItem } from "../cart-storage";
import { TaxIncludedNote } from "@/components/catalog/tax-included-note";

import { formatCurrency } from "./format";

interface CartLinesProps {
  items: CartItem[];
  onQuantityChange: (id: string, rawValue: string) => void;
  onRemove: (id: string) => void;
  /** Keeps input ids unique when the lines render outside the drawer (cart page). */
  idPrefix?: string;
}

export function CartLines({ items, onQuantityChange, onRemove, idPrefix = "drawer" }: CartLinesProps) {
  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className="rounded-2xl border border-brand-line p-4">
          <p className="font-black text-brand-navy">{item.name}</p>
          <p className="text-sm font-bold text-brand-muted">{formatCurrency(item.priceCents)} c/u</p>
          <TaxIncludedNote className="mt-1" />
          <div className="mt-3 flex items-center gap-3">
            <label htmlFor={`${idPrefix}-qty-${item.id}`} className="text-xs font-black uppercase tracking-widest text-brand-muted">
              Cantidad
            </label>
            <input
              id={`${idPrefix}-qty-${item.id}`}
              aria-label={`Cantidad para ${item.name}`}
              type="number"
              min="1"
              max={CART_QUANTITY_LIMIT}
              step="1"
              value={item.quantity}
              onChange={(event) => onQuantityChange(item.id, event.target.value)}
              className="w-20 rounded-xl border border-brand-line px-3 py-2 text-center font-black text-brand-navy"
            />
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={`Quitar ${item.name} del pedido`}
              className="ml-auto inline-flex items-center gap-1.5 text-sm font-black text-brand-blue hover:underline"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              Quitar
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
