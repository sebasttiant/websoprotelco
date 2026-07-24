import * as repository from "./repository";
import type { CustomerQuoteRow, QuoteRow } from "./repository";
import type {
  ContactRequestInput,
  CustomerQuoteSummary,
  QuoteListFilters,
  QuoteStatus,
  QuoteStatusUpdateInput,
  QuoteSummary,
} from "./schemas";

// Statuses that can no longer transition anywhere: a closed deal or a cancelled request.
const TERMINAL_QUOTE_STATUSES = new Set<QuoteStatus>(["won", "lost", "cancelled"]);

// The only status changes the commercial workflow allows. Any transition not listed here
// is rejected, even if both statuses are individually valid enum members.
const QUOTE_TRANSITIONS: Readonly<Record<QuoteStatus, readonly QuoteStatus[]>> = {
  received: ["in_review", "cancelled"],
  in_review: ["quoted", "lost", "cancelled"],
  quoted: ["won", "lost", "cancelled"],
  won: [],
  lost: [],
  cancelled: [],
};

export type QuoteStatusUpdateOutcome = "updated" | "unchanged" | "not-found" | "invalid-transition";

function toItemCount(value: string): number {
  return Number.parseInt(value, 10);
}

// pg hands back bigint aggregates as strings so nothing is silently rounded in the driver.
// A total beyond Number.MAX_SAFE_INTEGER is decoded as unknown rather than as a quietly
// rounded number, on the same principle as the cart's overflow guard: no total beats a
// wrong total.
function toTotalCents(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function mapQuoteSummary(row: QuoteRow): QuoteSummary {
  return {
    id: row.id,
    reference: row.reference,
    kind: row.kind,
    status: row.status,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    companyName: row.company_name,
    createdAt: row.created_at,
    itemCount: toItemCount(row.item_count),
    totalCents: toTotalCents(row.total_cents),
  };
}

function createReference(): string {
  return `WEB-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

// `userId` is the session user's id when the request is submitted while signed in, or
// NULL for an anonymous guest. It is resolved server-side by the caller (never taken
// from form input) and fixes ownership at insert time.
export async function submitQuoteRequest(input: ContactRequestInput, userId: string | null): Promise<void> {
  await repository.insertQuoteRequest({
    reference: createReference(),
    contactName: input.name,
    contactEmail: input.email,
    contactPhone: input.phone,
    message: `[${input.subject}] ${input.message}`,
    userId,
  });
}

export async function getQuotes(filters: QuoteListFilters = {}): Promise<QuoteSummary[]> {
  const rows = await repository.findQuotes(filters);
  return rows.map(mapQuoteSummary);
}

function mapCustomerQuoteSummary(row: CustomerQuoteRow): CustomerQuoteSummary {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    message: row.message,
    createdAt: row.created_at,
  };
}

// Returns a user's own recent quotes. `userId` MUST be the session user's own id,
// resolved server-side from their session. A falsy id is rejected before any query
// runs so a missing owner can never reach the database as a NULL parameter and widen
// the scope to guest quotes.
export async function getQuotesForUser(userId: string): Promise<CustomerQuoteSummary[]> {
  if (!userId) {
    return [];
  }

  const rows = await repository.findQuotesByUserId(userId);
  return rows.map(mapCustomerQuoteSummary);
}

export async function updateQuoteStatus(input: QuoteStatusUpdateInput): Promise<QuoteStatusUpdateOutcome> {
  const currentStatus = await repository.findQuoteStatusById(input.id);

  if (!currentStatus) {
    return "not-found";
  }

  if (currentStatus === input.status) {
    return "unchanged";
  }

  if (TERMINAL_QUOTE_STATUSES.has(currentStatus) || !QUOTE_TRANSITIONS[currentStatus].includes(input.status)) {
    return "invalid-transition";
  }

  await repository.updateQuoteStatusById(input.id, input.status);
  return "updated";
}
