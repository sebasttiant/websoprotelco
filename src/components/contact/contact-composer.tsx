"use client";

import { useState, type FormEvent } from "react";

import { toWhatsAppHref } from "@/components/layout/contact-href";

interface ContactComposerProps {
  whatsappNumber: string;
  quotedProduct: string | null;
}

export function ContactComposer({ whatsappNumber, quotedProduct }: ContactComposerProps) {
  const [missingNumber, setMissingNumber] = useState(false);
  const canSend = toWhatsAppHref(whatsappNumber) !== null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const subject = String(data.get("subject") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();
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
    if (!href) {
      setMissingNumber(true);
      return;
    }

    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 md:grid-cols-2">
      <div id="contact-availability" role="status" className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900 md:col-span-2">
        {canSend && !missingNumber
          ? "Tu mensaje se abre en WhatsApp con los datos que completes. No hace falta crear una cuenta."
          : "El envío en línea todavía no está disponible. Para atención inmediata, usa el teléfono o el correo de ventas."}
        {quotedProduct ? <span className="block pt-2">Producto consultado: {quotedProduct}</span> : null}
      </div>

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
        className="rounded-full bg-emerald-500 px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-500/20 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300 md:col-span-2"
        disabled={!canSend}
      >
        Enviar por WhatsApp
      </button>
    </form>
  );
}
