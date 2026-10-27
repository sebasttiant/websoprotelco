import "server-only";

import { getSiteSettings } from "@/domains/settings";
import { formatCurrencyCents } from "@/lib/presentation";

import { enqueueNotification, NOTIFICATION_CHANNELS } from "./outbox";

const OPS_MAILBOX_FALLBACK = "info@soprotelco.com";

export interface OrderNotifyLine {
  name: string;
  quantity: number;
  unitPriceCents: number;
}

export interface OrderNotifyPayload {
  reference: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  totalCents: number;
  lines: readonly OrderNotifyLine[];
  channelHint: "whatsapp" | "form" | "admin";
}

export interface ContactNotifyPayload {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  productSlug?: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildOrderNotifyEmail(payload: OrderNotifyPayload, to: string): { to: string; subject: string; text: string; html: string } {
  const subject = `Pedido ${payload.reference} — SOPROTELCO`;
  const lineText = payload.lines
    .map((line) => `• ${line.quantity} × ${line.name} — ${formatCurrencyCents(line.unitPriceCents * line.quantity)}`)
    .join("\n");
  const text = [
    "Nuevo pedido registrado en la web SOPROTELCO",
    "",
    `Referencia: ${payload.reference}`,
    `Canal: ${payload.channelHint}`,
    `Nombre: ${payload.contactName}`,
    `Correo: ${payload.contactEmail}`,
    `Teléfono: ${payload.contactPhone}`,
    payload.notes.trim() ? `Notas: ${payload.notes.trim()}` : "Notas: (sin notas)",
    "",
    "Productos:",
    lineText || "(sin líneas)",
    "",
    `Total: ${formatCurrencyCents(payload.totalCents)} (IVA incluido)`,
  ].join("\n");

  const lineHtml = payload.lines
    .map(
      (line) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(line.name)}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${line.quantity}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(formatCurrencyCents(line.unitPriceCents * line.quantity))}</td></tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#0f172a;background:#f8fafc;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:16px;overflow:hidden;">
    <div style="background:#0b3a66;color:#fff;padding:20px 24px;">
      <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.85;">SOPROTELCO</p>
      <h1 style="margin:8px 0 0;font-size:22px;">Nuevo pedido ${escapeHtml(payload.reference)}</h1>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;"><strong>Canal:</strong> ${escapeHtml(payload.channelHint)}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="padding:6px 0;color:#64748b;">Nombre</td><td style="padding:6px 0;text-align:right;font-weight:700;">${escapeHtml(payload.contactName)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Correo</td><td style="padding:6px 0;text-align:right;font-weight:700;">${escapeHtml(payload.contactEmail)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Teléfono</td><td style="padding:6px 0;text-align:right;font-weight:700;">${escapeHtml(payload.contactPhone)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Notas</td><td style="padding:6px 0;text-align:right;font-weight:700;">${escapeHtml(payload.notes.trim() || "(sin notas)")}</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <thead><tr style="background:#f1f5f9;text-align:left;"><th style="padding:10px 12px;">Producto</th><th style="padding:10px 12px;text-align:center;">Cant.</th><th style="padding:10px 12px;text-align:right;">Total</th></tr></thead>
        <tbody>${lineHtml || `<tr><td colspan="3" style="padding:12px;">Sin líneas</td></tr>`}</tbody>
      </table>
      <p style="margin:20px 0 0;font-size:18px;font-weight:800;">Total: ${escapeHtml(formatCurrencyCents(payload.totalCents))}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">IVA incluido</p>
    </div>
  </div>
</body></html>`;

  return { to, subject, text, html };
}

export function buildContactNotifyEmail(
  payload: ContactNotifyPayload,
  to: string,
): { to: string; subject: string; text: string; html: string } {
  const subject = `Contacto web: ${payload.subject}`;
  const text = [
    "Nuevo mensaje desde el formulario de contacto SOPROTELCO",
    "",
    `Nombre: ${payload.name}`,
    `Correo: ${payload.email}`,
    `Teléfono: ${payload.phone}`,
    `Asunto: ${payload.subject}`,
    payload.productSlug ? `Producto: ${payload.productSlug}` : "",
    "",
    "Mensaje:",
    payload.message,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#0f172a;background:#f8fafc;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:16px;overflow:hidden;">
    <div style="background:#0b3a66;color:#fff;padding:20px 24px;">
      <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.85;">SOPROTELCO</p>
      <h1 style="margin:8px 0 0;font-size:22px;">${escapeHtml(payload.subject)}</h1>
    </div>
    <div style="padding:24px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="padding:6px 0;color:#64748b;">Nombre</td><td style="padding:6px 0;text-align:right;font-weight:700;">${escapeHtml(payload.name)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Correo</td><td style="padding:6px 0;text-align:right;font-weight:700;">${escapeHtml(payload.email)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Teléfono</td><td style="padding:6px 0;text-align:right;font-weight:700;">${escapeHtml(payload.phone)}</td></tr>
        ${payload.productSlug ? `<tr><td style="padding:6px 0;color:#64748b;">Producto</td><td style="padding:6px 0;text-align:right;font-weight:700;">${escapeHtml(payload.productSlug)}</td></tr>` : ""}
      </table>
      <div style="padding:16px;border-radius:12px;background:#f1f5f9;white-space:pre-wrap;line-height:1.6;">${escapeHtml(payload.message)}</div>
    </div>
  </div>
</body></html>`;

  return { to, subject, text, html };
}

async function resolveOpsMailbox(): Promise<string> {
  try {
    const settings = await getSiteSettings();
    const configured = settings.contactEmail.trim().toLowerCase();
    if (configured.includes("@")) return configured;
  } catch (error) {
    console.error("Could not resolve contact email for ops notify:", error);
  }
  return OPS_MAILBOX_FALLBACK;
}

/**
 * Persist a structured ops email in the notification outbox.
 * Delivery uses SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM when a transport worker is configured;
 * this path never fails the customer checkout or contact form.
 */
export async function notifyOpsOrderCreated(payload: OrderNotifyPayload): Promise<void> {
  try {
    const to = await resolveOpsMailbox();
    const mail = buildOrderNotifyEmail(payload, to);
    await enqueueNotification({
      channel: NOTIFICATION_CHANNELS.EMAIL,
      eventType: "order.created",
      payload: { ...mail, smtpHostConfigured: Boolean(process.env.SMTP_HOST?.trim()) },
    });
  } catch (error) {
    console.error("Failed to enqueue order ops notification:", error);
  }
}

export async function notifyOpsContactMessage(payload: ContactNotifyPayload): Promise<void> {
  try {
    const to = await resolveOpsMailbox();
    const mail = buildContactNotifyEmail(payload, to);
    await enqueueNotification({
      channel: NOTIFICATION_CHANNELS.EMAIL,
      eventType: "contact.submitted",
      payload: { ...mail, smtpHostConfigured: Boolean(process.env.SMTP_HOST?.trim()) },
    });
  } catch (error) {
    console.error("Failed to enqueue contact ops notification:", error);
  }
}
