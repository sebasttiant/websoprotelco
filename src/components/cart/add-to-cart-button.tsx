"use client";

import { Check, ShoppingCart } from "lucide-react";
import { useState } from "react";

import { addCartItem, type CartItemInput } from "./cart-storage";

type AddToCartButtonProps = CartItemInput;

export function AddToCartButton({ id, slug, name, priceCents, currency }: AddToCartButtonProps) {
  const [status, setStatus] = useState("");

  function add(): void {
    const result = addCartItem({ id, slug, name, priceCents, currency });
    setStatus(result.valid && result.normalized
      ? `Se ajustó la cantidad máxima a ${result.quantity}.`
      : result.valid ? `${name} se agregó al carrito.` : result.message);
  }

  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      <button type="button" onClick={add} aria-label={`Agregar ${name} al carrito`} className="inline-flex items-center gap-2 rounded-full bg-brand-blue px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-700">
        <ShoppingCart aria-hidden="true" className="h-4 w-4" />
        Agregar
      </button>
      {status ? (
        <span role="status" className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
          <Check aria-hidden="true" className="h-3.5 w-3.5" />
          {status}
        </span>
      ) : null}
    </span>
  );
}
