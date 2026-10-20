import { leadSourceLabel, leadStatusLabel, quoteStatusLabel } from "@/lib/presentation";

import { MAX_TREND_DAYS, type DashboardData } from "./dashboard-query";
import type {
  DailyTrendPoint,
  FullAdminReport,
  NamedCount,
  ReportRange,
  StatusCount,
  StatusSlice,
} from "./schemas";

export function toSlices(rows: StatusCount[], labelFor: (status: string) => string): StatusSlice[] {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return rows.map((row) => ({
    status: row.status,
    label: labelFor(row.status),
    count: row.count,
    percent: total > 0 ? Math.round((row.count / total) * 1000) / 10 : 0,
  }));
}

export function namedToSlices(rows: NamedCount[], labelFor?: (name: string) => string): StatusSlice[] {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return rows.map((row) => ({
    status: row.name,
    label: labelFor ? labelFor(row.name) : row.name,
    count: row.count,
    percent: total > 0 ? Math.round((row.count / total) * 1000) / 10 : 0,
  }));
}

function bogotaYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Fill missing Bogotá calendar days so bar charts keep a continuous axis. */
export function fillDailyTrend(points: DailyTrendPoint[], from: Date, to: Date): DailyTrendPoint[] {
  const byDay = new Map(points.map((point) => [point.date, point]));
  const filled: DailyTrendPoint[] = [];
  const startKey = bogotaYmd(from);
  const endKey = bogotaYmd(to);
  const cursor = new Date(from.getTime());

  for (let guard = 0; guard < MAX_TREND_DAYS + 7; guard += 1) {
    const key = bogotaYmd(cursor);
    if (key > endKey) break;
    if (key >= startKey) {
      const existing = byDay.get(key);
      filled.push(
        existing ?? {
          date: key,
          label: key.slice(5),
          orders: 0,
          quotes: 0,
        },
      );
    }
    cursor.setTime(cursor.getTime() + 24 * 60 * 60 * 1000);
  }

  return filled;
}

export function assembleFullAdminReport(range: ReportRange, data: DashboardData): FullAdminReport {
  return {
    range,
    fromIso: data.from?.toISOString() ?? null,
    toIso: data.toIso,
    commercial: data.commercial,
    ordersByStatus: data.ordersByStatus,
    quotesByStatus: data.quotesByStatus,
    ordersSlices: toSlices(data.ordersByStatus, quoteStatusLabel),
    quotesSlices: toSlices(data.quotesByStatus, quoteStatusLabel),
    leadsSlices: toSlices(data.leadsByStatus, leadStatusLabel),
    leadSourceSlices: namedToSlices(data.leadsBySource, leadSourceLabel),
    categorySlices: namedToSlices(data.productsByCategory),
    dailyTrend: fillDailyTrend(data.dailyTrendRaw, data.trendFrom, new Date(data.toIso)),
    monthlyRevenue: data.monthlyRevenue,
    topProducts: data.topProducts,
    catalog: data.catalog,
    productsByCategory: data.productsByCategory,
    leadsByStatus: data.leadsByStatus,
    leadsBySource: data.leadsBySource,
    leadTotal: data.leadTotal,
  };
}
