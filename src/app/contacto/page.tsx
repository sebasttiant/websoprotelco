import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Container } from "@/components/ui/container";
import { submitContactRequest } from "./actions";

interface ContactPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const params = await searchParams;
  const sent = firstParam(params.sent) === "1";
  const validationError = firstParam(params.error) === "validation";

  return (
    <main className="min-h-screen bg-brand-ice">
      <Header />
      <section className="bg-brand-navy py-20 text-center text-white">
        <Container>
          <h1 className="text-4xl font-black tracking-tight md:text-5xl">Contáctanos</h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl font-medium leading-8 text-blue-100/80">
            Nuestro equipo está listo para ayudarte con cotizaciones, soporte técnico y proyectos de conectividad.
          </p>
        </Container>
      </section>

      <Container className="relative -mt-10 pb-20">
        <div className="grid gap-8 lg:grid-cols-3">
          <aside className="space-y-6">
            <article className="rounded-3xl bg-white p-8 shadow-xl shadow-blue-950/5">
              <h2 className="mb-2 text-xl font-black text-brand-navy">Llamadas y WhatsApp</h2>
              <p className="mb-4 font-medium leading-7 text-brand-muted">Atención inmediata para ventas y soporte técnico.</p>
              <a href="https://wa.me/573001234567" className="text-lg font-black text-brand-blue hover:underline">+57 300 123 4567</a>
            </article>
            <article className="rounded-3xl bg-white p-8 shadow-xl shadow-blue-950/5">
              <h2 className="mb-2 text-xl font-black text-brand-navy">Correo Electrónico</h2>
              <p className="mb-4 font-medium leading-7 text-brand-muted">Para solicitudes formales, cotizaciones y alianzas.</p>
              <a href="mailto:ventas@soprotelco.com" className="break-all text-lg font-black text-brand-blue hover:underline">ventas@soprotelco.com</a>
            </article>
            <article className="rounded-3xl bg-white p-8 shadow-xl shadow-blue-950/5">
              <h2 className="mb-4 text-xl font-black text-brand-navy">Horario de Atención</h2>
              <ul className="space-y-3 font-medium text-brand-muted">
                <li className="flex justify-between gap-4"><span>Lunes — Viernes</span><span className="font-black text-brand-navy">8:00 - 18:00</span></li>
                <li className="flex justify-between gap-4"><span>Sábados</span><span className="font-black text-brand-navy">9:00 - 13:00</span></li>
                <li className="flex justify-between gap-4"><span>Domingos</span><span className="font-black text-brand-navy">Cerrado</span></li>
              </ul>
            </article>
          </aside>

          <section className="rounded-3xl bg-white p-8 shadow-xl shadow-blue-950/5 lg:col-span-2 lg:p-10">
            <div className="mb-8">
              <h2 className="text-3xl font-black text-brand-navy">Envíanos un mensaje</h2>
              <p className="mt-3 font-medium leading-7 text-brand-muted">Completa el formulario y un asesor especializado te contactará.</p>
            </div>

            {sent ? (
              <div className="mb-6 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                Mensaje recibido. Un asesor de SOPROTELCO te contactará pronto.
              </div>
            ) : null}

            {validationError ? (
              <div className="mb-6 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-700">
                Revisa los campos del formulario e intenta nuevamente.
              </div>
            ) : null}

            <form action={submitContactRequest} className="grid gap-6 md:grid-cols-2">
              <label className="space-y-2 text-sm font-black uppercase tracking-wider text-brand-navy">
                Nombre Completo
                <input name="name" required placeholder="Ej: Juan Pérez" className="w-full rounded-2xl border border-brand-line bg-brand-ice p-4 font-medium normal-case tracking-normal outline-none focus:border-brand-blue" />
              </label>
              <label className="space-y-2 text-sm font-black uppercase tracking-wider text-brand-navy">
                Correo Electrónico
                <input name="email" type="email" required placeholder="juan@empresa.com" className="w-full rounded-2xl border border-brand-line bg-brand-ice p-4 font-medium normal-case tracking-normal outline-none focus:border-brand-blue" />
              </label>
              <label className="space-y-2 text-sm font-black uppercase tracking-wider text-brand-navy">
                WhatsApp / Teléfono
                <input name="phone" required placeholder="+57 3..." className="w-full rounded-2xl border border-brand-line bg-brand-ice p-4 font-medium normal-case tracking-normal outline-none focus:border-brand-blue" />
              </label>
              <label className="space-y-2 text-sm font-black uppercase tracking-wider text-brand-navy">
                Asunto
                <select name="subject" className="w-full rounded-2xl border border-brand-line bg-brand-ice p-4 font-medium normal-case tracking-normal outline-none focus:border-brand-blue">
                  <option>Cotización de Productos</option>
                  <option>Asesoría Técnica</option>
                  <option>Soporte de Pedido</option>
                  <option>Otro</option>
                </select>
              </label>
              <label className="space-y-2 text-sm font-black uppercase tracking-wider text-brand-navy md:col-span-2">
                Tu mensaje
                <textarea name="message" required placeholder="¿En qué podemos ayudarte hoy?" className="min-h-40 w-full rounded-2xl border border-brand-line bg-brand-ice p-4 font-medium normal-case tracking-normal outline-none focus:border-brand-blue" />
              </label>
              <button type="submit" className="rounded-full bg-brand-blue px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-blue-500/20 transition hover:bg-blue-700 md:col-span-2">
                Enviar Mensaje
              </button>
            </form>
          </section>
        </div>
      </Container>
      <Footer />
    </main>
  );
}
