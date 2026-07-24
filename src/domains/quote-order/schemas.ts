import { z } from "zod";

// --- Quote status -----------------------------------------------------------

export const QUOTE_STATUSES = ["received", "in_review", "quoted", "won", "lost", "cancelled"] as const;

export const quoteStatusSchema = z.enum(QUOTE_STATUSES);

export type QuoteStatus = z.infer<typeof quoteStatusSchema>;

export function isQuoteStatus(value: string): value is QuoteStatus {
  return (QUOTE_STATUSES as readonly string[]).includes(value);
}

// --- Quote kind -------------------------------------------------------------
//
// A quote request and an order are the same record with different intent, discriminated by
// `kind` (migration 0013). They share the status machine, the reference generator and every
// query, so splitting them into two tables would only duplicate all three and force a
// reconciliation the day a quote is accepted and becomes an order.
//
// Every list MUST scope by kind. The legacy dashboard omitted this filter and counted quotes
// as orders, which is why its "Pedidos recientes" showed the exact rows of its quotes list.

export const QUOTE_KINDS = ["quote", "order"] as const;

export const quoteKindSchema = z.enum(QUOTE_KINDS);

export type QuoteKind = z.infer<typeof quoteKindSchema>;

export function isQuoteKind(value: string): value is QuoteKind {
  return (QUOTE_KINDS as readonly string[]).includes(value);
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

// --- Cart order submission ---------------------------------------------------
//
// What this schema DOES NOT accept is the point: no price, and no product name.
//
// The cart lives in the visitor's localStorage, so every field in it is attacker-controlled —
// editing `priceCents` to 1 takes a devtools console and five seconds. The legacy checkout
// posted `price: item.price` straight from the browser and stored it, which means the order
// total was whatever the customer said it was.
//
// The server accepts an id and a quantity, then reads the price and the name from the products
// table itself. A client can ask for a product; it can never state what that product costs.
export const cartOrderItemInputSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().positive().max(99),
});

export type CartOrderItemInput = z.infer<typeof cartOrderItemInputSchema>;

export const cartOrderInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(180),
  phone: z.string().trim().min(7).max(50),
  notes: z.string().trim().max(2_000).default(""),
  // An empty order is never a real intent, and the max bounds a single request's write size.
  items: z.array(cartOrderItemInputSchema).min(1).max(99),
});

export type CartOrderInput = z.infer<typeof cartOrderInputSchema>;

export interface CartOrderResult {
  reference: string;
  totalCents: number;
}

// --- Admin read model --------------------------------------------------------

export const quoteSummarySchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  kind: quoteKindSchema,
  status: quoteStatusSchema,
  contactName: z.string(),
  contactEmail: z.email(),
  contactPhone: z.string().nullable(),
  companyName: z.string().nullable(),
  createdAt: z.string(),
  itemCount: z.number().int(),
  // Null means "unknown", never "zero". Items created before migration 0013 carry no price
  // snapshot, and summing only the priced ones would render a confidently wrong total that
  // looks like a real, smaller amount. The UI shows "—" instead.
  totalCents: z.number().int().nonnegative().nullable(),
});

export type QuoteSummary = z.infer<typeof quoteSummarySchema>;

export const quoteListFiltersSchema = z.object({
  status: quoteStatusSchema.optional(),
  kind: quoteKindSchema.optional(),
});

export type QuoteListFilters = z.infer<typeof quoteListFiltersSchema>;

// --- Customer self-service read model ----------------------------------------
// Recent quotes shown to a signed-in customer on their own account page. Always
// scoped by the customer's own user_id (resolved server-side from their session),
// never by an email or id taken from route params or form input.

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
