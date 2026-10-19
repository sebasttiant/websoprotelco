/**
 * Report chart palette — semantic status colors + series + chrome.
 * Hex values (not CSS variables) because Recharts paints SVG fills that do not
 * reliably resolve custom properties at paint time for status slices.
 */

export const STATUS_COLORS: Record<string, string> = {
  // Quotes / orders
  received: "#0ea5e9",
  in_review: "#2563eb",
  quoted: "#7c3aed",
  won: "#16a34a",
  lost: "#dc2626",
  cancelled: "#64748b",
  // Leads
  new: "#0ea5e9",
  contacted: "#2563eb",
  qualified: "#7c3aed",
  converted: "#16a34a",
  // Catalog / fallback series
  contact_form: "#0b66c3",
  whatsapp: "#16a34a",
  manual: "#f59e0b",
  other: "#64748b",
};

/** Rotating palette when the slice key is unknown (categories, etc.). */
export const CATEGORY_PALETTE = [
  "#0b66c3",
  "#0ea5e9",
  "#16a34a",
  "#f59e0b",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#64748b",
] as const;

export const SERIES_COLORS = {
  orders: "#0b66c3",
  quotes: "#f59e0b",
  revenue: "#16a34a",
} as const;

export const CHART_CHROME = {
  grid: "#e2e8f0",
  axisLine: "#cbd5e1",
  tick: "#64748b",
  cursor: "#0b66c3",
} as const;

export function colorForStatus(status: string, index = 0): string {
  return STATUS_COLORS[status] ?? CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
}
