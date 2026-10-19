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

/** Only these keys can be written from admin — blocks inventing or mangling keys. */
export const ALLOWED_SETTING_KEYS = [
  "site_name",
  "site_description",
  "contact_email",
  "contact_phone",
  "address",
  "business_hours",
  "facebook_url",
  "instagram_url",
  "linkedin_url",
  "whatsapp_number",
] as const;

export type AllowedSettingKey = (typeof ALLOWED_SETTING_KEYS)[number];

const SOCIAL_URL_KEYS = new Set(["facebook_url", "instagram_url", "linkedin_url"]);

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isWhatsAppNumber(value: string): boolean {
  const digits = value.replace(/[^\d]/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function isPhoneLike(value: string): boolean {
  return /^[+()\d\s.-]{6,40}$/.test(value);
}

// --- Mutation input ------------------------------------------------------------

// Admin-only mutation input. Keys are allowlisted so a caller cannot invent
// storage keys or smuggle SQL/column names. Values are validated per key so a
// typo cannot break WhatsApp, contact email, or social links on the storefront.
export const settingUpdateInputSchema = z
  .object({
    key: z.enum(ALLOWED_SETTING_KEYS),
    value: z.string().max(2000),
  })
  .superRefine((input, ctx) => {
    const value = input.value.trim();

    if (input.key === "contact_email" && value !== "" && !z.email().safeParse(value).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "A valid email is required for contact_email.",
      });
    }

    if (input.key === "whatsapp_number" && value !== "" && !isWhatsAppNumber(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "WhatsApp must include country code and 8–15 digits (e.g. +573001234567).",
      });
    }

    if (input.key === "contact_phone" && value !== "" && !isPhoneLike(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Phone may only contain digits, spaces, and + ( ) . -",
      });
    }

    if (SOCIAL_URL_KEYS.has(input.key) && value !== "" && !isHttpUrl(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Social links must be a full http(s) URL.",
      });
    }

    if (input.key === "site_name" && value.length > 120) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Site name must be 120 characters or fewer.",
      });
    }
  });

export type SettingUpdateInput = z.infer<typeof settingUpdateInputSchema>;
