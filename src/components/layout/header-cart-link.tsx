"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";

import { CartDrawer } from "@/components/cart/cart-drawer";
import { cartChangedEventName, readCart } from "@/components/cart/cart-storage";

interface HeaderCartLinkProps {
  /** From settings.whatsapp_number. Empty hides the WhatsApp confirmation path. */
  whatsappNumber: string;
}

// The cart lives only in the browser, so the count hydrates client-side (0 on the server) and
// updates live: it re-reads on the cart-changed event and on cross-tab `storage` events.
//
// This stays an anchor to /carrito rather than becoming a bare button. With JavaScript the
// click is intercepted and the drawer opens; without it the link still navigates to the full
// cart page, which keeps working. The drawer is an enhancement, not a replacement.
export function HeaderCartLink({ whatsappNumber }: HeaderCartLinkProps) {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);

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
    <>
      <Link
        href="/carrito"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          // Modified clicks (new tab, new window) and non-primary buttons keep their native
          // behaviour instead of being hijacked into a panel the visitor did not ask for.
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
            return;
          }

          event.preventDefault();
          setOpen(true);
        }}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-blue text-white shadow-glow transition hover:bg-brand-primary"
      >
        <ShoppingCart aria-hidden="true" className="h-5 w-5" />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand-accent px-1 text-[0.65rem] font-black text-brand-navy">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </Link>
      <CartDrawer open={open} onClose={() => setOpen(false)} whatsappNumber={whatsappNumber} />
    </>
  );
}
