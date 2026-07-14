import { z } from "zod";

// --- Read models -------------------------------------------------------------

// Settings row shown on the admin settings page. Every setting is a free-form
// key/value pair, so value and description stay nullable to mirror the column.
export const settingSummarySchema = z.object({
  id: z.uuid(),
  key: z.string(),
  value: z.string().nullable(),
  description: z.string().nullable(),
  updatedAt: z.string(),
});

export type SettingSummary = z.infer<typeof settingSummarySchema>;

// Public read model assembled from the key/value rows. It exists so consumers (header,
// footer, WhatsApp CTA) depend on a typed shape instead of knowing the storage keys.
// Social URLs are nullable because the seed ships them blank and the UI hides the icon.
export const siteSettingsSchema = z.object({
  siteName: z.string(),
  siteDescription: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string(),
  address: z.string(),
  businessHours: z.string(),
  facebookUrl: z.string().nullable(),
  instagramUrl: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  whatsappNumber: z.string(),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

// --- Mutation input ------------------------------------------------------------

// Admin-only mutation input. `key` is restricted to the same lower_snake_case
// shape the seed data uses, so a caller cannot smuggle an arbitrary column name
// or SQL fragment through the key field.
export const settingUpdateInputSchema = z
  .object({
    key: z
      .string()
      .trim()
      .regex(/^[a-z0-9_]+$/, { error: "Invalid setting key." })
      .max(100),
    value: z.string().max(2000),
  })
  .superRefine((input, ctx) => {
    if (input.key === "contact_email" && input.value !== "" && !z.email().safeParse(input.value).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "A valid email is required for contact_email.",
      });
    }
  });

export type SettingUpdateInput = z.infer<typeof settingUpdateInputSchema>;
