"use client";

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
    <>
      <button type="button" onClick={add} className="rounded-full bg-brand-blue px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-700">
        Agregar
      </button>
      <span className="sr-only" role="status">{status}</span>
    </>
  );
}
