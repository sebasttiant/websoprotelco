import { z } from "zod";

// --- Quote status -----------------------------------------------------------

export const QUOTE_STATUSES = ["received", "in_review", "quoted", "won", "lost", "cancelled"] as const;

export const quoteStatusSchema = z.enum(QUOTE_STATUSES);

export type QuoteStatus = z.infer<typeof quoteStatusSchema>;

export function isQuoteStatus(value: string): value is QuoteStatus {
  return (QUOTE_STATUSES as readonly string[]).includes(value);
}

// --- Public contact/quote request submission --------------------------------

export const contactRequestInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(180),
  phone: z.string().trim().min(7).max(50),
  subject: z.string().trim().min(2).max(120),
  message: z.string().trim().min(10).max(2_000),
});

export type ContactRequestInput = z.infer<typeof contactRequestInputSchema>;

// --- Admin read model --------------------------------------------------------

export const quoteSummarySchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  status: quoteStatusSchema,
  contactName: z.string(),
  contactEmail: z.email(),
  contactPhone: z.string().nullable(),
  companyName: z.string().nullable(),
  createdAt: z.string(),
  itemCount: z.number().int(),
});

export type QuoteSummary = z.infer<typeof quoteSummarySchema>;

export const quoteListFiltersSchema = z.object({
  status: quoteStatusSchema.optional(),
});

export type QuoteListFilters = z.infer<typeof quoteListFiltersSchema>;

// --- Customer self-service read model ----------------------------------------
// Recent quotes shown to a signed-in customer on their own account page. Always
// scoped by the customer's own email (resolved server-side from their session),
// never by an email taken from route params or form input.

export const customerQuoteSummarySchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  status: quoteStatusSchema,
  message: z.string(),
  createdAt: z.string(),
});

export type CustomerQuoteSummary = z.infer<typeof customerQuoteSummarySchema>;

// --- Admin mutation input ----------------------------------------------------

export const quoteStatusUpdateInputSchema = z.object({
  id: z.uuid(),
  status: quoteStatusSchema,
});

export type QuoteStatusUpdateInput = z.infer<typeof quoteStatusUpdateInputSchema>;
