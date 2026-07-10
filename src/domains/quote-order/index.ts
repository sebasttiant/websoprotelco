// Public surface of the quote-order domain. Consumers (contact page, admin quotes page,
// components) must import from here rather than reaching into ./schemas, ./repository,
// ./service, or ./actions directly.

export type {
  ContactRequestInput,
  QuoteListFilters,
  QuoteStatus,
  QuoteStatusUpdateInput,
  QuoteSummary,
} from "./schemas";

export { isQuoteStatus, QUOTE_STATUSES } from "./schemas";

export { submitContactRequest, updateQuoteStatus, type AdminActionState } from "./actions";

export { getQuotes } from "./service";
