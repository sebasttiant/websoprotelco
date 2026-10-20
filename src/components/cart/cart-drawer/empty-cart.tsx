import Link from "next/link";

export function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="rounded-[28px] bg-brand-ice p-10 text-center">
      <p className="text-lg font-black text-brand-navy">Tu pedido está vacío.</p>
      <Link
        href="/productos"
        onClick={onClose}
        className="mt-5 inline-block rounded-full bg-brand-blue px-6 py-3 text-xs font-black uppercase tracking-widest text-white"
      >
        Ver catálogo
      </Link>
    </div>
  );
}
