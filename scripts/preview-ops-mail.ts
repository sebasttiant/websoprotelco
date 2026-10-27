/**
 * Writes HTML previews of the ops mailbox emails so we can review layout without SMTP.
 * Usage: pnpm exec tsx scripts/preview-ops-mail.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildContactNotifyEmail,
  buildOrderNotifyEmail,
} from "../src/server/notifications/ops-mail-templates";

const outDir = resolve(process.cwd(), "tmp/mail-preview");
mkdirSync(outDir, { recursive: true });

const order = buildOrderNotifyEmail(
  {
    reference: "WEB-DEMO01",
    contactName: "Sebastián Pares",
    contactEmail: "sebastian@empresa.com",
    contactPhone: "+57 300 555 0101",
    notes: "Entregar en Bogotá · urgente para obra",
    totalCents: 255_000_00,
    lines: [
      { name: "Localizador visual de fallos VFL 10 km", quantity: 2, unitPriceCents: 90_000_00 },
      { name: "Ponchadora RJ45 profesional", quantity: 1, unitPriceCents: 75_000_00 },
    ],
    channelHint: "whatsapp",
  },
  "info@soprotelco.com",
);

const contact = buildContactNotifyEmail(
  {
    name: "Sergio Faeres",
    email: "sergio@empresa.com",
    phone: "+57 310 444 2211",
    subject: "Cotización de Productos",
    message: "Hola, necesito cotización de fusionadora y stock disponible para esta semana.",
    productSlug: "fusionadora-segura",
  },
  "info@soprotelco.com",
);

const orderPath = resolve(outDir, "order-whatsapp.html");
const contactPath = resolve(outDir, "contact-form.html");
const indexPath = resolve(outDir, "index.html");

writeFileSync(orderPath, order.html, "utf8");
writeFileSync(contactPath, contact.html, "utf8");
writeFileSync(
  indexPath,
  `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Preview mails SOPROTELCO</title>
  <style>body{font-family:system-ui;margin:2rem;background:#f4f7fc}a{display:block;margin:.75rem 0;font-weight:700;color:#0f4c81}
  pre{background:#fff;border:1px solid #e0e8f2;padding:1rem;border-radius:12px;white-space:pre-wrap}</style></head>
  <body>
  <h1>Preview — correos a info@soprotelco.com</h1>
  <p>Así se ven (y el texto plano debajo) cuando el cliente confirma por WhatsApp o envía contacto.</p>
  <a href="./order-whatsapp.html" target="_blank">1) Pedido vía WhatsApp (HTML)</a>
  <a href="./contact-form.html" target="_blank">2) Formulario de contacto (HTML)</a>
  <h2>Texto plano del pedido</h2>
  <pre>${order.text.replaceAll("<", "&lt;")}</pre>
  <h2>Asunto pedido</h2>
  <pre>${order.subject}</pre>
  <h2>Texto plano del contacto</h2>
  <pre>${contact.text.replaceAll("<", "&lt;")}</pre>
  </body></html>`,
  "utf8",
);

console.log(`Wrote:\n  ${indexPath}\n  ${orderPath}\n  ${contactPath}`);
console.log(`Subject order: ${order.subject}`);
console.log(`To: ${order.to} | replyTo: ${order.replyTo}`);
