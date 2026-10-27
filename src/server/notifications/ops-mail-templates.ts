import { formatCurrencyCents } from "@/lib/presentation";

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

function channelLabel(channel: OrderNotifyPayload["channelHint"]): string {
  switch (channel) {
    case "whatsapp":
      return "WhatsApp (copia automática al correo)";
    case "admin":
      return "Panel administrativo";
    default:
      return "Formulario web";
  }
}

function emailShell(options: {
  eyebrow: string;
  title: string;
  bodyHtml: string;
  footerNote?: string;
}): string {
  const footer =
    options.footerNote ??
    "Este mensaje se generó automáticamente desde la web SOPROTELCO. Respondé al cliente usando el correo indicado arriba.";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f7fc;font-family:Arial,Helvetica,sans-serif;color:#0a1728;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fc;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #e0e8f2;border-radius:16px;overflow:hidden;">
          <tr><td style="height:6px;background:#f5c400;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="background:#0c1a2a;color:#ffffff;padding:22px 28px;">
              <p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#7cf3ff;font-weight:700;">${escapeHtml(options.eyebrow)}</p>
              <h1 style="margin:10px 0 0;font-size:22px;line-height:1.3;font-weight:800;">${escapeHtml(options.title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              ${options.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #e0e8f2;background:#f8fafc;">
              <p style="margin:0;font-size:12px;line-height:1.55;color:#5e6c80;">${escapeHtml(footer)}</p>
              <p style="margin:10px 0 0;font-size:12px;color:#5e6c80;">Buzón operativo: <strong style="color:#0f4c81;">info@soprotelco.com</strong></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#5e6c80;font-size:13px;width:38%;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#0a1728;font-size:14px;font-weight:700;text-align:right;vertical-align:top;">${escapeHtml(value)}</td>
  </tr>`;
}

export function buildOrderNotifyEmail(
  payload: OrderNotifyPayload,
  to: string,
): { to: string; subject: string; text: string; html: string; replyTo?: string } {
  const channel = channelLabel(payload.channelHint);
  const subject = `[Pedido] ${payload.reference} — ${payload.contactName}`;
  const notes = payload.notes.trim() || "(sin notas)";
  const lineText = payload.lines
    .map(
      (line) =>
        `  • ${line.quantity} × ${line.name} — ${formatCurrencyCents(line.unitPriceCents)} c/u = ${formatCurrencyCents(line.unitPriceCents * line.quantity)}`,
    )
    .join("\n");

  const text = [
    "══════════════════════════════════════",
    "  SOPROTELCO — NUEVO PEDIDO WEB",
    "══════════════════════════════════════",
    "",
    `Referencia : ${payload.reference}`,
    `Canal      : ${channel}`,
    "",
    "— Cliente —",
    `Nombre     : ${payload.contactName}`,
    `Correo     : ${payload.contactEmail}`,
    `Teléfono   : ${payload.contactPhone}`,
    `Notas      : ${notes}`,
    "",
    "— Productos —",
    lineText || "  (sin líneas)",
    "",
    `TOTAL (IVA incluido): ${formatCurrencyCents(payload.totalCents)}`,
    "",
    "Respondé al cliente con el correo indicado.",
    `Copia operativa → ${to}`,
  ].join("\n");

  const lineHtml = payload.lines
    .map(
      (line) => `<tr>
        <td style="padding:12px;border-bottom:1px solid #eef2f7;font-size:14px;color:#0a1728;">${escapeHtml(line.name)}</td>
        <td style="padding:12px;border-bottom:1px solid #eef2f7;text-align:center;font-size:14px;font-weight:700;">${line.quantity}</td>
        <td style="padding:12px;border-bottom:1px solid #eef2f7;text-align:right;font-size:13px;color:#5e6c80;">${escapeHtml(formatCurrencyCents(line.unitPriceCents))}</td>
        <td style="padding:12px;border-bottom:1px solid #eef2f7;text-align:right;font-size:14px;font-weight:800;color:#0a1728;">${escapeHtml(formatCurrencyCents(line.unitPriceCents * line.quantity))}</td>
      </tr>`,
    )
    .join("");

  const bodyHtml = `
    <p style="margin:0 0 18px;display:inline-block;padding:6px 12px;border-radius:999px;background:#fff8db;color:#7a5b00;font-size:12px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(channel)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
      ${detailRow("Referencia", payload.reference)}
      ${detailRow("Nombre", payload.contactName)}
      ${detailRow("Correo", payload.contactEmail)}
      ${detailRow("Teléfono / WhatsApp", payload.contactPhone)}
      ${detailRow("Notas", notes)}
    </table>
    <p style="margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#0f4c81;">Detalle del pedido</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e8f2;border-radius:12px;overflow:hidden;margin-bottom:18px;">
      <thead>
        <tr style="background:#f4f7fc;text-align:left;">
          <th style="padding:11px 12px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#5e6c80;">Producto</th>
          <th style="padding:11px 12px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#5e6c80;text-align:center;">Cant.</th>
          <th style="padding:11px 12px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#5e6c80;text-align:right;">Unitario</th>
          <th style="padding:11px 12px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#5e6c80;text-align:right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${lineHtml || `<tr><td colspan="4" style="padding:14px;color:#5e6c80;">Sin líneas</td></tr>`}
      </tbody>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c1a2a;border-radius:12px;">
      <tr>
        <td style="padding:16px 18px;color:#7cf3ff;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">Total · IVA incluido</td>
        <td style="padding:16px 18px;text-align:right;color:#ffffff;font-size:22px;font-weight:800;">${escapeHtml(formatCurrencyCents(payload.totalCents))}</td>
      </tr>
    </table>`;

  return {
    to,
    subject,
    text,
    html: emailShell({
      eyebrow: "SOPROTELCO · Pedidos",
      title: `Nuevo pedido ${payload.reference}`,
      bodyHtml,
    }),
    replyTo: payload.contactEmail,
  };
}

export function buildContactNotifyEmail(
  payload: ContactNotifyPayload,
  to: string,
): { to: string; subject: string; text: string; html: string; replyTo?: string } {
  const subject = `[Contacto] ${payload.subject} — ${payload.name}`;
  const text = [
    "══════════════════════════════════════",
    "  SOPROTELCO — MENSAJE DE CONTACTO",
    "══════════════════════════════════════",
    "",
    `Asunto    : ${payload.subject}`,
    `Nombre    : ${payload.name}`,
    `Correo    : ${payload.email}`,
    `Teléfono  : ${payload.phone}`,
    payload.productSlug ? `Producto  : ${payload.productSlug}` : "",
    "",
    "— Mensaje —",
    payload.message,
    "",
    `Copia operativa → ${to}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const bodyHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
      ${detailRow("Asunto", payload.subject)}
      ${detailRow("Nombre", payload.name)}
      ${detailRow("Correo", payload.email)}
      ${detailRow("Teléfono / WhatsApp", payload.phone)}
      ${payload.productSlug ? detailRow("Producto consultado", payload.productSlug) : ""}
    </table>
    <p style="margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#0f4c81;">Mensaje del cliente</p>
    <div style="padding:16px 18px;border-radius:12px;background:#f4f7fc;border-left:4px solid #f5c400;white-space:pre-wrap;line-height:1.65;font-size:14px;color:#0a1728;">${escapeHtml(payload.message)}</div>`;

  return {
    to,
    subject,
    text,
    html: emailShell({
      eyebrow: "SOPROTELCO · Contacto web",
      title: payload.subject,
      bodyHtml,
    }),
    replyTo: payload.email,
  };
}
