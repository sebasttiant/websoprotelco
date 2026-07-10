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

function mapQuoteSummary(row: QuoteRow): QuoteSummary {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    companyName: row.company_name,
    createdAt: row.created_at,
    itemCount: toItemCount(row.item_count),
  };
}

function createReference(): string {
  return `WEB-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function submitQuoteRequest(input: ContactRequestInput): Promise<void> {
  await repository.insertQuoteRequest({
    reference: createReference(),
    contactName: input.name,
    contactEmail: input.email,
    contactPhone: input.phone,
    message: `[${input.subject}] ${input.message}`,
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

// Returns a customer's own recent quotes. `email` MUST be the session user's own
// email, resolved server-side from their session — this function performs no
// ownership check itself and trusts the email it is given as the scope.
export async function getQuotesForCustomer(email: string): Promise<CustomerQuoteSummary[]> {
  const rows = await repository.findQuotesByCustomerEmail(email);
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
