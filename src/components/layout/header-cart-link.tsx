"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";

import { cartChangedEventName, readCart } from "@/components/cart/cart-storage";

// The cart lives only in the browser, so the count hydrates client-side (0 on the server) and
// updates live: it re-reads on the cart-changed event and on cross-tab `storage` events.
export function HeaderCartLink() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(readCart().reduce((total, item) => total + item.quantity, 0));
    update();

    const eventName = cartChangedEventName();
    window.addEventListener(eventName, update);
    window.addEventListener("storage", update);

    return () => {
      window.removeEventListener(eventName, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  const label = count > 0 ? `Carrito, ${count} producto${count === 1 ? "" : "s"}` : "Carrito";

  return (
    <Link
      href="/carrito"
      aria-label={label}
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-blue text-white shadow-glow transition hover:bg-brand-primary"
    >
      <ShoppingCart aria-hidden="true" className="h-5 w-5" />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand-accent px-1 text-[0.65rem] font-black text-brand-navy">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
