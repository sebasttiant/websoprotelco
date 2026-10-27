import Link from "next/link";
import { ArrowRight, Headset, ShieldCheck, Truck } from "lucide-react";

import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";

const SUPPORT_ITEMS = [
  {
    title: "Asesoría Técnica Experta",
    text: "Te ayudamos a diseñar tu red y seleccionar equipos compatibles con tu necesidad.",
    icon: Headset,
  },
  {
    title: "Garantía y Calidad",
    text: "Trabajamos con suministros certificados y soporte postventa para proyectos críticos.",
    icon: ShieldCheck,
  },
  {
    title: "Envíos Nacionales",
    text: "Coordinamos despachos seguros para mantener tus instalaciones avanzando.",
    icon: Truck,
  },
] as const;

export function Support() {
  return (
    <section className="bg-brand-ice pb-16 pt-14 sm:pb-20 sm:pt-16">
      <Container>
        <div className="mb-11 text-center">
          <p className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-brand-fiber/45 bg-white px-4 py-1.5 text-[0.65rem] font-black uppercase tracking-widest text-brand-navy">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-fiber" />
            Respaldo total
          </p>
          <h2 className="text-balance text-2xl font-black tracking-tight text-brand-navy sm:text-3xl">
            ¿Por qué confiar en Soprotelco?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-7 text-brand-muted">
            Proveemos soluciones de fibra óptica y conectividad con acompañamiento técnico y enfoque empresarial.
          </p>
        </div>

        <div className="grid items-stretch gap-5 md:grid-cols-3 md:gap-6">
          {SUPPORT_ITEMS.map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.title} delayMs={index * 80} className="h-full">
                <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-brand-line bg-white px-6 pb-6 pt-8 transition duration-300 hover:-translate-y-0.5 hover:border-brand-fiber/60 hover:shadow-[0_18px_40px_-20px_rgb(12_26_42_/_32%)]">
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-1.5 bg-brand-fiber transition-[height] duration-300 group-hover:h-2"
                  />
                  <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl border border-brand-fiber/30 bg-brand-ice text-brand-blue transition group-hover:border-brand-fiber/55 group-hover:bg-white group-hover:text-brand-navy">
                    <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
                  </div>
                  <h3 className="mb-2 text-lg font-black tracking-tight text-brand-navy">{item.title}</h3>
                  <p className="flex-1 text-sm font-medium leading-6 text-brand-muted">{item.text}</p>
                </article>
              </Reveal>
            );
          })}
        </div>

        <div className="relative mt-12 flex flex-col items-center justify-between gap-6 overflow-hidden rounded-3xl border-2 border-brand-blue/80 bg-white p-7 text-center shadow-[0_12px_28px_-18px_rgb(15_76_129_/_35%)] md:flex-row md:p-9 md:text-left">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-brand-fiber" />
          <div className="min-w-0 pt-1">
            <h3 className="text-xl font-black tracking-tight text-brand-navy sm:text-2xl">
              ¿Necesitas una cotización corporativa?
            </h3>
            <p className="mt-2 text-sm font-medium text-brand-muted sm:text-base">
              Hablemos de volumen, disponibilidad y soporte para tu proyecto.
            </p>
          </div>
          <Link
            href="/contacto"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand-blue px-7 py-3.5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-brand-primary"
          >
            Hablar con un asesor
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
