import Link from "next/link";

import { Container } from "@/components/ui/container";

export default function ProductNotFound() {
  return (
    <main className="min-h-screen bg-brand-ice py-24">
      <Container className="max-w-2xl text-center">
        <p className="text-sm font-black uppercase tracking-widest text-brand-blue">Producto no encontrado</p>
        <h1 className="mt-4 text-4xl font-black text-brand-navy">No encontramos este producto</h1>
        <p className="mt-4 font-medium text-brand-muted">Puede que ya no esté disponible o que el enlace sea incorrecto.</p>
        <Link href="/productos" className="mt-8 inline-block rounded-full bg-brand-blue px-6 py-3 text-sm font-black uppercase tracking-widest text-white">Volver al catálogo</Link>
      </Container>
    </main>
  );
}
