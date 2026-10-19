import { z } from "zod";

export const REPORT_RANGES = ["7", "30", "90", "all"] as const;
export const reportRangeSchema = z.enum(REPORT_RANGES);
export type ReportRange = z.infer<typeof reportRangeSchema>;

export const REPORT_EXPORT_SECTIONS = ["summary", "orders", "quotes", "catalog", "leads", "all"] as const;
export const reportExportSectionSchema = z.enum(REPORT_EXPORT_SECTIONS);
export type ReportExportSection = z.infer<typeof reportExportSectionSchema>;

export const REPORT_EXPORT_FORMATS = ["csv", "xlsx"] as const;
export const reportExportFormatSchema = z.enum(REPORT_EXPORT_FORMATS);
export type ReportExportFormat = z.infer<typeof reportExportFormatSchema>;

export function isReportRange(value: string): value is ReportRange {
  return (REPORT_RANGES as readonly string[]).includes(value);
}

export function isReportExportSection(value: string): value is ReportExportSection {
  return (REPORT_EXPORT_SECTIONS as readonly string[]).includes(value);
}

export function isReportExportFormat(value: string): value is ReportExportFormat {
  return (REPORT_EXPORT_FORMATS as readonly string[]).includes(value);
}

/** Resolve a preset range to an inclusive lower bound (UTC midnight), or null for all-time. */
export function rangeStartDate(range: ReportRange, now = new Date()): Date | null {
  if (range === "all") return null;
  const days = Number.parseInt(range, 10);
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

export interface StatusCount {
  status: string;
  count: number;
}

/** Slice ready for donut charts (label + percent precomputed). */
export interface StatusSlice {
  status: string;
  label: string;
  count: number;
  percent: number;
}

export interface NamedCount {
  name: string;
  count: number;
}

/** One day of commercial creation volume for trend bars. */
export interface DailyTrendPoint {
  date: string;
  label: string;
  orders: number;
  quotes: number;
}

export interface MonthlyRevenue {
  month: string;
  revenueCents: number;
  orderCount: number;
}

export interface TopProductRow {
  productId: string | null;
  name: string;
  quantity: number;
  revenueCents: number;
}

export interface CatalogReport {
  total: number;
  active: number;
  inactive: number;
  missingImage: number;
  lowStock: number;
  outOfStock: number;
  catalogValueCents: number;
}

export interface CommercialReport {
  orders: number;
  quotes: number;
  wonOrders: number;
  lostOrders: number;
  pendingOrders: number;
  openQuotes: number;
  revenueCents: number;
  wonWithoutTotal: number;
  conversionPercent: number;
}

export interface FullAdminReport {
  range: ReportRange;
  fromIso: string | null;
  toIso: string;
  commercial: CommercialReport;
  ordersByStatus: StatusCount[];
  quotesByStatus: StatusCount[];
  ordersSlices: StatusSlice[];
  quotesSlices: StatusSlice[];
  leadsSlices: StatusSlice[];
  leadSourceSlices: StatusSlice[];
  categorySlices: StatusSlice[];
  dailyTrend: DailyTrendPoint[];
  monthlyRevenue: MonthlyRevenue[];
  topProducts: TopProductRow[];
  catalog: CatalogReport;
  productsByCategory: NamedCount[];
  leadsByStatus: StatusCount[];
  leadsBySource: NamedCount[];
  leadTotal: number;
}
