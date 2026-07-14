import { z } from "zod";

export const PUBLIC_BANNER_LIMIT = 5;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DESIGN_IMAGE_PATH_PATTERN = /^\/uploads\/(banners|hero)\/[0-9a-fA-F-]{36}_[A-Za-z0-9._-]+\.(jpg|png|webp)$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" || value === undefined ? undefined : value));

const nullableImagePathSchema = z
  .union([
    z.string().trim().regex(DESIGN_IMAGE_PATH_PATTERN, { error: "Invalid image path." }),
    z.literal(""),
  ])
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

const optionalDateSchema = z
  .union([z.string().trim().regex(DATE_PATTERN, { error: "Date must use YYYY-MM-DD format." }), z.literal("")])
  .optional()
  .transform((value) => (value === "" || value === undefined ? undefined : value));

const optionalUrlSchema = z
  .union([z.string().trim().url({ error: "Link URL must be a valid URL." }).max(500), z.literal("")])
  .optional()
  .transform((value) => (value === "" || value === undefined ? undefined : value));

const ctaLinkSchema = z.string().trim().min(1, { error: "CTA link is required." }).max(500);

function hasValidDateRange(input: { startDate?: string; endDate?: string }): boolean {
  return !input.startDate || !input.endDate || input.startDate <= input.endDate;
}

export const bannerSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  subtitle: z.string().nullable(),
  imagePath: z.string(),
  linkUrl: z.string().nullable(),
  displayOrder: z.number().int(),
  isActive: z.boolean(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type BannerSummary = z.infer<typeof bannerSummarySchema>;

export const heroSettingsSchema = z.object({
  id: z.uuid().nullable(),
  backgroundImage: z.string().nullable(),
  title: z.string(),
  subtitle: z.string(),
  ctaText: z.string(),
  ctaLink: z.string(),
  updatedBy: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type HeroSettings = z.infer<typeof heroSettingsSchema>;

export const bannerCreateInputSchema = z
  .object({
    title: z.string().trim().min(1, { error: "Title is required." }).max(200, { error: "Title must be 200 characters or fewer." }),
    subtitle: optionalText(500),
    imagePath: z.string().trim().max(500).regex(DESIGN_IMAGE_PATH_PATTERN, { error: "Invalid image path." }),
    linkUrl: optionalUrlSchema,
    displayOrder: z.coerce.number().int().default(0),
    isActive: z.coerce.boolean().default(true),
    startDate: optionalDateSchema,
    endDate: optionalDateSchema,
  })
  .refine(hasValidDateRange, { message: "Start date must be before end date.", path: ["endDate"] });

export type BannerCreateInput = z.infer<typeof bannerCreateInputSchema>;

export const bannerUpdateInputSchema = bannerCreateInputSchema.extend({ id: z.uuid() });

export type BannerUpdateInput = z.infer<typeof bannerUpdateInputSchema>;

export const bannerDeleteInputSchema = z.object({ id: z.uuid() });

export type BannerDeleteInput = z.infer<typeof bannerDeleteInputSchema>;

export const heroSettingsUpdateInputSchema = z.object({
  backgroundImage: nullableImagePathSchema,
  title: z.string().trim().min(1, { error: "Title is required." }).max(200),
  subtitle: z.string().trim().min(1, { error: "Subtitle is required." }),
  ctaText: z.string().trim().min(1, { error: "CTA text is required." }).max(100),
  ctaLink: ctaLinkSchema,
});

export type HeroSettingsUpdateInput = z.infer<typeof heroSettingsUpdateInputSchema>;

export function isSafeDesignImagePath(path: string): boolean {
  return DESIGN_IMAGE_PATH_PATTERN.test(path);
}
