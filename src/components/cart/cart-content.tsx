"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { calculateCartTotal, CART_CURRENCIES, CART_QUANTITY_LIMIT, cartChangedEventName, readCart, type CartItem, validateQuantity, writeCart } from "./cart-storage";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: CART_CURRENCIES.COP, minimumFractionDigits: 0 }).format(cents / 100);
}

export function CartContent() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const sync = () => setItems(readCart());
    sync();
    window.addEventListener(cartChangedEventName(), sync);
    return () => window.removeEventListener(cartChangedEventName(), sync);
  }, []);

  function update(id: string, rawValue: string): void {
    const result = validateQuantity(Number(rawValue));
    if (!result.valid) {
      setStatus(result.message);
      return;
    }
    const next = items.map((item) => item.id === id ? { ...item, quantity: result.quantity } : item);
    writeCart(next);
    setItems(next);
    setStatus(result.normalized ? `Cantidad ajustada al máximo de ${CART_QUANTITY_LIMIT}.` : "Cantidad actualizada.");
  }

  function remove(id: string): void {
    const next = items.filter((item) => item.id !== id);
    writeCart(next);
    setItems(next);
    setStatus("Producto eliminado del carrito.");
  }

  const total = calculateCartTotal(items);

  if (items.length === 0) {
    return <section className="rounded-[32px] bg-white p-10 text-center shadow-xl shadow-blue-950/5"><h2 className="text-2xl font-black text-brand-navy">Tu carrito está vacío</h2><p className="mt-3 text-brand-muted">Agrega equipos del catálogo para preparar tu solicitud de cotización.</p><Link href="/productos" className="mt-6 inline-block rounded-full bg-brand-blue px-6 py-3 text-xs font-black uppercase tracking-widest text-white">Volver al catálogo</Link></section>;
  }

  return <section aria-label="Productos del carrito" className="rounded-[32px] bg-white p-6 shadow-xl shadow-blue-950/5 sm:p-8"><p role="status" aria-live="polite" className="mb-4 text-sm font-bold text-brand-muted">{status}</p><div className="space-y-5">{items.map((item) => <article key={item.id} className="flex flex-col gap-4 border-b border-brand-line pb-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black text-brand-navy">{item.name}</h2><p className="text-sm font-bold text-brand-muted">{formatCurrency(item.priceCents)} por unidad</p></div><div className="flex items-center gap-3"><label className="text-sm font-bold text-brand-navy" htmlFor={`quantity-${item.id}`}>Cantidad</label><input id={`quantity-${item.id}`} aria-label={`Cantidad para ${item.name}`} type="number" min="1" max={CART_QUANTITY_LIMIT} step="1" value={item.quantity} onChange={(event) => update(item.id, event.target.value)} className="w-20 rounded-xl border border-brand-line px-3 py-2 text-center font-black text-brand-navy"/><button type="button" onClick={() => remove(item.id)} className="text-sm font-black text-brand-blue hover:underline">Eliminar</button></div></article>)}</div><div className="mt-6 flex flex-col gap-4 border-t border-brand-line pt-6 sm:flex-row sm:items-center sm:justify-between">{total.valid ? <p className="text-xl font-black text-brand-navy">Total estimado: <output>{formatCurrency(total.totalCents)}</output></p> : <p role="alert" className="text-sm font-bold text-brand-blue">{total.message}</p>}<Link href="/contacto" className="rounded-full bg-brand-blue px-6 py-3 text-center text-xs font-black uppercase tracking-widest text-white">Preparar cotización</Link></div><p className="mt-4 text-sm text-brand-muted">Esta selección solo está en este navegador. Aún no envía una solicitud ni realiza pagos.</p></section>;
}
