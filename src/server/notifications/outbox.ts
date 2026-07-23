import "server-only";

import { z } from "zod";

import { query } from "@/server/db/pool";

export const NOTIFICATION_CHANNELS = {
  EMAIL: "email",
  WHATSAPP: "whatsapp",
} as const;

const notificationChannelSchema = z.enum([NOTIFICATION_CHANNELS.EMAIL, NOTIFICATION_CHANNELS.WHATSAPP]);

const notificationInputSchema = z.object({
  channel: notificationChannelSchema,
  eventType: z.string().trim().min(1).max(100),
  payload: z.record(z.string(), z.unknown()),
});

export type NotificationChannel = z.infer<typeof notificationChannelSchema>;
export type NotificationInput = z.infer<typeof notificationInputSchema>;

export interface NotificationTransaction {
  query(text: string, values?: readonly unknown[]): Promise<unknown>;
}

export async function enqueueNotification(input: unknown, transaction?: NotificationTransaction): Promise<void> {
  const parsed = notificationInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("Invalid notification input.");
  }

  const notification = parsed.data;

  const text = `INSERT INTO notification_outbox (channel, event_type, payload)
     VALUES ($1, $2, $3::jsonb)`;
  const values = [notification.channel, notification.eventType, JSON.stringify(notification.payload)];

  // Called on its instance, never destructured: a detached `pg.Client`/`pg.PoolClient`
  // method loses its `this` receiver and fails at runtime.
  if (transaction) {
    await transaction.query(text, values);

    return;
  }

  await query(text, values);
}
