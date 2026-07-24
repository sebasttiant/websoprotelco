// Public surface of the quote-order domain. Server consumers (contact page, admin quotes and
// orders pages) must import from here rather than reaching into ./schemas, ./repository,
// ./service, or ./actions directly.
//
// CLIENT components are the one exception, and they have no choice: this barrel re-exports the
// service, which reaches the repository and its `import "server-only"`, so importing it from a
// "use client" module fails the build. Those import ./actions (a "use server" module, shipped
// to the browser as RPC references) or ./schemas (pure, isomorphic) instead.

export type {
  CartOrderInput,
  CartOrderItemInput,
  CartOrderResult,
  ContactRequestInput,
  CustomerQuoteSummary,
  QuoteKind,
  QuoteListFilters,
  QuoteStatus,
  QuoteStatusUpdateInput,
  QuoteSummary,
} from "./schemas";

export { isQuoteKind, isQuoteStatus, QUOTE_KINDS, QUOTE_STATUSES } from "./schemas";

export {
  submitCartOrder,
  submitContactRequest,
  updateQuoteStatus,
  type AdminActionState,
  type CartOrderActionState,
} from "./actions";

export { getQuotes, getQuotesForUser } from "./service";
