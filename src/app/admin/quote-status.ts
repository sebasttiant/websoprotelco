export const QUOTE_STATUSES = ["received", "in_review", "quoted", "won", "lost", "cancelled"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
