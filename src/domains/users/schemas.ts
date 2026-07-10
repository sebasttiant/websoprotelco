import { z } from "zod";

// --- Read models -------------------------------------------------------------

// Admin user directory row. Deliberately omits the credential column: this read
// reaches the admin Users page as a client-serializable payload.
export const adminUserSummarySchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

export type AdminUserSummary = z.infer<typeof adminUserSummarySchema>;

// Customer account overview shown on /cuenta. Always resolved from the session
// user's own id, never from user input.
export const accountOverviewSchema = z.object({
  email: z.email(),
  fullName: z.string().nullable(),
  role: z.string(),
  createdAt: z.string(),
});

export type AccountOverview = z.infer<typeof accountOverviewSchema>;

// Editable profile fields shown on /cuenta/perfil.
export const profileDetailsSchema = z.object({
  email: z.email(),
  fullName: z.string().nullable(),
});

export type ProfileDetails = z.infer<typeof profileDetailsSchema>;

// --- Self-service mutation input --------------------------------------------

// Self-service profile edits change the display name only. Email is intentionally
// NOT editable here: account ownership (including quote history) is bound to the
// user id and email, so a user must not be able to repoint their account at another
// address. Unknown keys such as a smuggled "email" are stripped by Zod's default
// object parsing and never reach the update.
export const profileUpdateInputSchema = z.object({
  name: z.string().trim().min(2, { error: "Name is required." }).max(160),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateInputSchema>;

export const passwordChangeInputSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "Current password is required." }),
    newPassword: z.string().min(12, { error: "New password must be at least 12 characters." }).max(200),
    confirmPassword: z.string().min(1, { error: "Password confirmation is required." }),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmPassword"], message: "Passwords do not match." });
    }
  });

export type PasswordChangeInput = z.infer<typeof passwordChangeInputSchema>;
