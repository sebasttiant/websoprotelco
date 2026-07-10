import Link from "next/link";

import { Container } from "@/components/ui/container";

const SUPPORT_ITEMS = [
  { title: "Asesoría Técnica Experta", text: "Te ayudamos a diseñar tu red y seleccionar equipos compatibles con tu necesidad." },
  { title: "Garantía y Calidad", text: "Trabajamos con suministros certificados y soporte postventa para proyectos críticos." },
  { title: "Envíos Nacionales", text: "Coordinamos despachos seguros para mantener tus instalaciones avanzando." },
] as const;

export function Support() {
  return (
    <section className="bg-white py-24">
      <Container>
        <div className="mb-14 text-center">
          <p className="mx-auto mb-4 inline-flex rounded-full bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-brand-blue">Respaldo total</p>
          <h2 className="text-4xl font-black tracking-tight text-brand-navy md:text-5xl">¿Por qué confiar en Soprotelco?</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-medium leading-8 text-brand-muted">
            Proveemos soluciones de fibra óptica y conectividad con acompañamiento técnico y enfoque empresarial.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {SUPPORT_ITEMS.map((item) => (
            <article key={item.title} className="rounded-[40px] bg-brand-ice p-10 transition hover:-translate-y-2 hover:bg-white hover:shadow-2xl hover:shadow-blue-950/5">
              <div className="mb-8 grid h-16 w-16 place-items-center rounded-3xl bg-blue-100 text-2xl font-black text-brand-blue">✓</div>
              <h3 className="mb-4 text-2xl font-black text-brand-navy">{item.title}</h3>
              <p className="font-medium leading-7 text-brand-muted">{item.text}</p>
            </article>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-8 overflow-hidden rounded-[40px] bg-brand-navy p-10 text-center text-white shadow-2xl shadow-blue-950/10 md:flex-row md:p-12 md:text-left">
          <div>
            <h3 className="text-3xl font-black">¿Necesitas una cotización corporativa?</h3>
            <p className="mt-3 text-lg font-medium text-blue-100/70">Hablemos de volumen, disponibilidad y soporte para tu proyecto.</p>
          </div>
          <Link href="/contacto" className="rounded-full bg-brand-blue px-10 py-5 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-blue-400/20 transition hover:bg-blue-700">
            Hablar con un asesor
          </Link>
        </div>
      </Container>
    </section>
  );
}
