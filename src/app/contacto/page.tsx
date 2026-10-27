import type { Metadata } from "next";

import { ContactComposer } from "@/components/contact/contact-composer";
import { toMailtoHref, toTelHref, toWhatsAppHref } from "@/components/layout/contact-href";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Container } from "@/components/ui/container";
import { getSiteSettings } from "@/domains/settings";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Contáctanos para cotizaciones, soporte técnico y proyectos de conectividad. SOPROTELCO: equipos de fibra óptica con asesoría técnica y despachos a toda Colombia.",
  alternates: { canonical: "/contacto" },
};

interface ContactPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isProductSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const params = await searchParams;
  const product = firstParam(params.producto).trim();
  const quotedProduct = isProductSlug(product) ? product : null;
  const settings = await getSiteSettings();
  const whatsappHref = toWhatsAppHref(settings.whatsappNumber);

  return (
    <main className="min-h-screen bg-brand-ice">
      <Header />
      <section className="border-b border-brand-line bg-white py-12 sm:py-14">
        <Container>
          <h1 className="text-balance text-2xl font-black tracking-tight text-brand-navy sm:text-3xl md:text-4xl">
            Contáctanos
          </h1>
          <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-brand-muted sm:text-lg">
            Nuestro equipo está listo para ayudarte con cotizaciones, soporte técnico y proyectos de conectividad.
          </p>
        </Container>
      </section>

      <Container className="py-12 pb-20">
        <div className="grid gap-8 lg:grid-cols-3">
          <aside className="space-y-6">
            <article className="rounded-3xl border border-brand-blue/25 bg-white p-8 shadow-sm shadow-blue-950/5">
              <h2 className="mb-2 text-xl font-black text-brand-navy">Llamadas y WhatsApp</h2>
              <p className="mb-4 font-medium leading-7 text-brand-muted">Atención inmediata para ventas y soporte técnico.</p>
              <a href={toTelHref(settings.contactPhone)} className="block text-lg font-black text-brand-blue hover:underline">
                {settings.contactPhone}
              </a>
              {whatsappHref ? (
                <a href={whatsappHref} aria-label="Contactar por WhatsApp" className="mt-3 inline-block text-sm font-black uppercase tracking-widest text-emerald-600 hover:underline">
                  Contactar por WhatsApp
                </a>
              ) : null}
            </article>
            <article className="rounded-3xl border border-brand-blue/25 bg-white p-8 shadow-sm shadow-blue-950/5">
              <h2 className="mb-2 text-xl font-black text-brand-navy">Correo Electrónico</h2>
              <p className="mb-4 font-medium leading-7 text-brand-muted">Para solicitudes formales, cotizaciones y alianzas.</p>
              <a href={toMailtoHref(settings.contactEmail)} className="break-all text-lg font-black text-brand-blue hover:underline">
                {settings.contactEmail}
              </a>
            </article>
            <article className="rounded-3xl border border-brand-blue/25 bg-white p-8 shadow-sm shadow-blue-950/5">
              <h2 className="mb-4 text-xl font-black text-brand-navy">Dónde y cuándo</h2>
              <p className="font-black text-brand-navy">{settings.address}</p>
              <p className="mt-3 font-medium text-brand-muted">{settings.businessHours}</p>
            </article>
          </aside>

          <section className="rounded-3xl border border-brand-blue/25 bg-white p-8 shadow-sm shadow-blue-950/5 lg:col-span-2 lg:p-10">
            <div className="mb-8">
              <h2 className="text-xl font-black tracking-tight text-brand-navy sm:text-2xl">Envíanos un mensaje</h2>
              <p className="mt-3 font-medium leading-7 text-brand-muted">
                Completá el formulario: lo registramos en el buzón de SOPROTELCO y, si hay WhatsApp, también lo abrimos con el mensaje listo.
              </p>
            </div>
            <ContactComposer whatsappNumber={settings.whatsappNumber} quotedProduct={quotedProduct} />
          </section>
        </div>
      </Container>
      <Footer />
    </main>
  );
}
