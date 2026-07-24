// Centralized presentation mappings for the admin panel.
//
// These translate *persisted* identifiers (roles, status enums, movement types) into
// professional Spanish for display ONLY. The raw values in the database never change — this
// module is the single boundary where an internal value becomes user-facing text, so a status
// is spelled the same way on every screen.
//
// Adding a new enum member? Add its label here and the UI follows automatically.

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  staff: "Personal",
  customer: "Cliente",
};

const PRODUCT_STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  qualified: "Calificado",
  converted: "Convertido",
  lost: "Perdido",
};

const LEAD_SOURCE_LABELS: Record<string, string> = {
  contact_form: "Formulario de contacto",
  whatsapp: "WhatsApp",
  manual: "Manual",
  other: "Otro",
};

// Quotes are grammatically feminine in Spanish ("la cotización"), so these labels differ from
// the leads vocabulary even where the English is the same ("lost" → "Perdida", not "Perdido").
const QUOTE_STATUS_LABELS: Record<string, string> = {
  received: "Recibida",
  in_review: "En revisión",
  quoted: "Cotizada",
  won: "Ganada",
  lost: "Perdida",
  cancelled: "Cancelada",
};

const QUOTE_KIND_LABELS: Record<string, string> = {
  quote: "Cotización",
  order: "Pedido",
};

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  sale: "Venta",
  purchase: "Compra",
  adjustment: "Ajuste",
  return: "Devolución",
};

const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  manual: "Manual",
  datasheet: "Ficha técnica",
  certificate: "Certificado",
  warranty: "Garantía",
  other: "Otro",
};

// Turns a raw identifier we have no explicit translation for into something readable, so an
// unmapped value degrades gracefully ("some_unknown_state" → "Some unknown state") instead of
// leaking a snake_case identifier to the user.
function humanize(value: string): string {
  if (value === "") {
    return "";
  }

  const spaced = value.replaceAll("_", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function labelFrom(map: Record<string, string>, value: string): string {
  return map[value] ?? humanize(value);
}

export function roleLabel(role: string): string {
  return labelFrom(ROLE_LABELS, role);
}

export function productStatusLabel(status: string): string {
  return labelFrom(PRODUCT_STATUS_LABELS, status);
}

export function leadStatusLabel(status: string): string {
  return labelFrom(LEAD_STATUS_LABELS, status);
}

export function leadSourceLabel(source: string): string {
  return labelFrom(LEAD_SOURCE_LABELS, source);
}

export function quoteStatusLabel(status: string): string {
  return labelFrom(QUOTE_STATUS_LABELS, status);
}

export function quoteKindLabel(kind: string): string {
  return labelFrom(QUOTE_KIND_LABELS, kind);
}

export function movementTypeLabel(type: string): string {
  return labelFrom(MOVEMENT_TYPE_LABELS, type);
}

export function documentCategoryLabel(category: string): string {
  return labelFrom(DOCUMENT_CATEGORY_LABELS, category);
}

// A best-effort resolver for a generic badge that only receives a raw value. Where the caller
// knows the domain, prefer the specific `*Label` function above (it disambiguates gendered
// duplicates like "lost"). Product/lead statuses win the "lost" collision here; callers that
// need the quote wording pass an explicit label.
const COMBINED_STATUS_LABELS: Record<string, string> = {
  ...QUOTE_STATUS_LABELS,
  ...PRODUCT_STATUS_LABELS,
  ...LEAD_STATUS_LABELS,
};

export function statusLabel(status: string): string {
  return labelFrom(COMBINED_STATUS_LABELS, status);
}

// --- Currency ----------------------------------------------------------------
//
// Money is stored in cents as an integer everywhere (products.price_cents,
// quote_request_items.unit_price_cents) so no amount ever passes through a float. Division
// happens here, once, at the very edge where the value becomes text.
//
// A null amount is an UNKNOWN total, not a zero one — see quoteSummarySchema.totalCents.
// Rendering it as "$ 0" would state, confidently, something we do not know.
export function formatCurrencyCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

// --- Date formatting ---------------------------------------------------------
//
// The whole admin renders dates in Colombian Spanish. Timezone is pinned to America/Bogota so
// the displayed calendar day is deterministic regardless of the server's system clock.
const LOCALE = "es-CO";
const TIME_ZONE = "America/Bogota";

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: Date | string | number | null | undefined): string {
  const date = toDate(value);
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(date);
}

export function formatDateTime(value: Date | string | number | null | undefined): string {
  const date = toDate(value);
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(date);
}
