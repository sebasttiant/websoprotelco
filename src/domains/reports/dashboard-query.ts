import * as repository from "./repository";
import {
  rangeStartDate,
  type CatalogReport,
  type CommercialReport,
  type DailyTrendPoint,
  type MonthlyRevenue,
  type NamedCount,
  type ReportRange,
  type StatusCount,
  type TopProductRow,
} from "./schemas";

const LOW_STOCK_THRESHOLD = 5;
export const MAX_TREND_DAYS = 90;

/** Raw dashboard aggregates plus the time bounds they were queried with. */
export interface DashboardData {
  from: Date | null;
  toIso: string;
  trendFrom: Date;
  commercial: CommercialReport;
  ordersByStatus: StatusCount[];
  quotesByStatus: StatusCount[];
  dailyTrendRaw: DailyTrendPoint[];
  monthlyRevenue: MonthlyRevenue[];
  topProducts: TopProductRow[];
  catalog: CatalogReport;
  productsByCategory: NamedCount[];
  leadsByStatus: StatusCount[];
  leadsBySource: NamedCount[];
  leadTotal: number;
}

export async function loadDashboardData(range: ReportRange): Promise<DashboardData> {
  const from = rangeStartDate(range);
  const toIso = new Date().toISOString();
  const trendFrom =
    from ??
    (() => {
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      start.setUTCDate(start.getUTCDate() - (MAX_TREND_DAYS - 1));
      return start;
    })();

  const [
    commercial,
    ordersByStatus,
    quotesByStatus,
    dailyTrendRaw,
    monthlyRevenue,
    topProducts,
    catalog,
    productsByCategory,
    leadsByStatus,
    leadsBySource,
    leadTotal,
  ] = await Promise.all([
    repository.findCommercialReport(from),
    repository.findStatusBreakdown("order", from),
    repository.findStatusBreakdown("quote", from),
    repository.findDailyTrend(trendFrom),
    repository.findMonthlyRevenue(6),
    repository.findTopProducts(from, 10),
    repository.findCatalogReport(LOW_STOCK_THRESHOLD),
    repository.findProductsByCategory(),
    repository.findLeadsByStatus(from),
    repository.findLeadsBySource(from),
    repository.countLeadsInRange(from),
  ]);

  return {
    from,
    toIso,
    trendFrom,
    commercial,
    ordersByStatus,
    quotesByStatus,
    dailyTrendRaw,
    monthlyRevenue,
    topProducts,
    catalog,
    productsByCategory,
    leadsByStatus,
    leadsBySource,
    leadTotal,
  };
}
