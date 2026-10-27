"use client";

import { useState, type FormEvent } from "react";

import { toWhatsAppHref } from "@/components/layout/contact-href";
import { submitContactMessage } from "@/domains/quote-order/actions";

interface ContactComposerProps {
  whatsappNumber: string;
  quotedProduct: string | null;
}

export function ContactComposer({ whatsappNumber, quotedProduct }: ContactComposerProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const whatsappAvailable = toWhatsAppHref(whatsappNumber) !== null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSent(false);

    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const subject = String(data.get("subject") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    const result = await submitContactMessage({
      name,
      email,
      phone,
      subject,
      message,
      productSlug: quotedProduct,
    });

    if (!result.success) {
      setPending(false);
      setError(result.message);
      return;
    }

    setSent(true);
    setPending(false);

    const lines = [
      "Hola, quiero contactar a SOPROTELCO.",
      `Nombre: ${name}`,
      `Correo: ${email}`,
      `Teléfono: ${phone}`,
      `Asunto: ${subject}`,
      quotedProduct ? `Producto: ${quotedProduct}` : "",
      "",
      message,
    ].filter((line) => line !== "");

    const href = toWhatsAppHref(whatsappNumber, lines.join("\n"));
    if (href) {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 md:grid-cols-2">
      <div id="contact-availability" role="status" className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900 md:col-span-2">
        Tu mensaje se registra en el buzón de SOPROTELCO con un formato claro y estructurado
        {whatsappAvailable ? " y también podés abrirlo en WhatsApp." : "."}
        {quotedProduct ? <span className="block pt-2">Producto consultado: {quotedProduct}</span> : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 md:col-span-2">
          {error}
        </p>
      ) : null}
      {sent ? (
        <p role="status" className="rounded-2xl bg-brand-ice p-4 text-sm font-bold text-brand-navy md:col-span-2">
          Mensaje registrado. Te contactamos pronto.
        </p>
      ) : null}

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
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand-blue px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-blue-500/20 transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:bg-slate-300 md:col-span-2"
      >
        {pending ? "Enviando…" : whatsappAvailable ? "Enviar y abrir WhatsApp" : "Enviar mensaje"}
      </button>
    </form>
  );
}
