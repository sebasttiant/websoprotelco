import { X } from "lucide-react";
import type { Ref } from "react";

interface DrawerHeaderProps {
  onClose: () => void;
  ref: Ref<HTMLButtonElement>;
}

export function DrawerHeader({ onClose, ref }: DrawerHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-brand-line px-6 py-5">
      <h2 className="text-xl font-black text-brand-navy">Tu pedido</h2>
      <button
        ref={ref}
        type="button"
        onClick={onClose}
        aria-label="Cerrar el pedido"
        className="rounded-full p-2 text-brand-muted transition hover:bg-brand-ice hover:text-brand-navy"
      >
        <X aria-hidden="true" className="h-5 w-5" />
      </button>
    </header>
  );
}
