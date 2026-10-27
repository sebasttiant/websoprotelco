import "server-only";

import { getSiteSettings } from "@/domains/settings";

import { enqueueNotification, NOTIFICATION_CHANNELS } from "./outbox";
import {
  buildContactNotifyEmail,
  buildOrderNotifyEmail,
  type ContactNotifyPayload,
  type OrderNotifyPayload,
} from "./ops-mail-templates";

export {
  buildContactNotifyEmail,
  buildOrderNotifyEmail,
  type ContactNotifyPayload,
  type OrderNotifyLine,
  type OrderNotifyPayload,
} from "./ops-mail-templates";

const OPS_MAILBOX_FALLBACK = "info@soprotelco.com";

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
 *
 * Orders confirmed via WhatsApp still enqueue this mail — WhatsApp is an extra customer
 * channel, not a replacement for the ops mailbox (info@ by default).
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
