/**
 * Parses a COP pesos amount typed by a non-technical admin.
 * Accepts "2500000", "2.500.000", "$ 2.500.000" — digits only after cleanup.
 * Returns whole pesos (never fractional centavos of a peso).
 */
export function parsePesosInput(raw: string): number {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return 0;
  return Number.parseInt(digits, 10);
}

/** Stores catalog prices as integer centavos (pesos × 100). */
export function pesosToCents(pesos: number): number {
  if (!Number.isFinite(pesos) || pesos < 0) return 0;
  return Math.round(pesos) * 100;
}

export function centsToPesos(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return Math.round(cents / 100);
}
