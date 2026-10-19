import { leadSourceLabel, leadStatusLabel, quoteStatusLabel } from "@/lib/presentation";

import * as repository from "./repository";
import {
  rangeStartDate,
  type DailyTrendPoint,
  type FullAdminReport,
  type NamedCount,
  type ReportExportSection,
  type ReportRange,
  type StatusCount,
  type StatusSlice,
} from "./schemas";

const LOW_STOCK_THRESHOLD = 5;
const MAX_TREND_DAYS = 90;

function toSlices(rows: StatusCount[], labelFor: (status: string) => string): StatusSlice[] {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return rows.map((row) => ({
    status: row.status,
    label: labelFor(row.status),
    count: row.count,
    percent: total > 0 ? Math.round((row.count / total) * 1000) / 10 : 0,
  }));
}

function namedToSlices(rows: NamedCount[], labelFor?: (name: string) => string): StatusSlice[] {
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
function fillDailyTrend(points: DailyTrendPoint[], from: Date, to: Date): DailyTrendPoint[] {
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

export async function getFullAdminReport(range: ReportRange): Promise<FullAdminReport> {
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
    range,
    fromIso: from?.toISOString() ?? null,
    toIso,
    commercial,
    ordersByStatus,
    quotesByStatus,
    ordersSlices: toSlices(ordersByStatus, quoteStatusLabel),
    quotesSlices: toSlices(quotesByStatus, quoteStatusLabel),
    leadsSlices: toSlices(leadsByStatus, leadStatusLabel),
    leadSourceSlices: namedToSlices(leadsBySource, leadSourceLabel),
    categorySlices: namedToSlices(productsByCategory),
    dailyTrend: fillDailyTrend(dailyTrendRaw, trendFrom, new Date(toIso)),
    monthlyRevenue,
    topProducts,
    catalog,
    productsByCategory,
    leadsByStatus,
    leadsBySource,
    leadTotal,
  };
}

function csvEscape(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export async function buildReportCsv(range: ReportRange, section: ReportExportSection): Promise<{
  filename: string;
  body: string;
}> {
  const report = await getFullAdminReport(range);
  const stamp = new Date().toISOString().slice(0, 10);
  const from = rangeStartDate(range);

  if (section === "summary" || section === "all") {
    const summary = toCsv(
      ["metric", "value"],
      [
        ["range", report.range],
        ["from", report.fromIso],
        ["to", report.toIso],
        ["orders", report.commercial.orders],
        ["quotes", report.commercial.quotes],
        ["won_orders", report.commercial.wonOrders],
        ["lost_orders", report.commercial.lostOrders],
        ["pending_orders", report.commercial.pendingOrders],
        ["open_quotes", report.commercial.openQuotes],
        ["revenue_cents", report.commercial.revenueCents],
        ["conversion_percent", report.commercial.conversionPercent],
        ["catalog_total", report.catalog.total],
        ["catalog_active", report.catalog.active],
        ["catalog_missing_image", report.catalog.missingImage],
        ["catalog_low_stock", report.catalog.lowStock],
        ["catalog_out_of_stock", report.catalog.outOfStock],
        ["catalog_value_cents", report.catalog.catalogValueCents],
        ["leads_total", report.leadTotal],
      ],
    );

    if (section === "summary") {
      return { filename: `soprotelco-resumen-${stamp}.csv`, body: summary };
    }

    const parts = [summary];

    const orders = await repository.findExportOrders(from, "order");
    parts.push(
      toCsv(
        ["reference", "status", "contact_name", "contact_email", "company", "created_at", "items", "total_cents"],
        orders.map((row) => [
          row.reference,
          row.status,
          row.contactName,
          row.contactEmail,
          row.companyName,
          row.createdAt,
          row.itemCount,
          row.totalCents,
        ]),
      ),
    );

    const quotes = await repository.findExportOrders(from, "quote");
    parts.push(
      toCsv(
        ["reference", "status", "contact_name", "contact_email", "company", "created_at", "items"],
        quotes.map((row) => [
          row.reference,
          row.status,
          row.contactName,
          row.contactEmail,
          row.companyName,
          row.createdAt,
          row.itemCount,
        ]),
      ),
    );

    parts.push(
      toCsv(
        ["category", "products"],
        report.productsByCategory.map((row) => [row.name, row.count]),
      ),
    );

    parts.push(
      toCsv(
        ["lead_status", "count"],
        report.leadsByStatus.map((row) => [row.status, row.count]),
      ),
    );

    return { filename: `soprotelco-reporte-completo-${stamp}.csv`, body: parts.join("\n") };
  }

  if (section === "orders") {
    const orders = await repository.findExportOrders(from, "order");
    return {
      filename: `soprotelco-pedidos-${stamp}.csv`,
      body: toCsv(
        ["reference", "status", "contact_name", "contact_email", "company", "created_at", "items", "total_cents"],
        orders.map((row) => [
          row.reference,
          row.status,
          row.contactName,
          row.contactEmail,
          row.companyName,
          row.createdAt,
          row.itemCount,
          row.totalCents,
        ]),
      ),
    };
  }

  if (section === "quotes") {
    const quotes = await repository.findExportOrders(from, "quote");
    return {
      filename: `soprotelco-cotizaciones-${stamp}.csv`,
      body: toCsv(
        ["reference", "status", "contact_name", "contact_email", "company", "created_at", "items"],
        quotes.map((row) => [
          row.reference,
          row.status,
          row.contactName,
          row.contactEmail,
          row.companyName,
          row.createdAt,
          row.itemCount,
        ]),
      ),
    };
  }

  if (section === "catalog") {
    return {
      filename: `soprotelco-catalogo-${stamp}.csv`,
      body: toCsv(
        ["metric", "value"],
        [
          ["total", report.catalog.total],
          ["active", report.catalog.active],
          ["inactive", report.catalog.inactive],
          ["missing_image", report.catalog.missingImage],
          ["low_stock", report.catalog.lowStock],
          ["out_of_stock", report.catalog.outOfStock],
          ["catalog_value_cents", report.catalog.catalogValueCents],
          ...report.productsByCategory.map((row) => [`category:${row.name}`, row.count]),
        ],
      ),
    };
  }

  return {
    filename: `soprotelco-leads-${stamp}.csv`,
    body: toCsv(
      ["dimension", "key", "count"],
      [
        ...report.leadsByStatus.map((row) => ["status", row.status, row.count]),
        ...report.leadsBySource.map((row) => ["source", row.name, row.count]),
      ],
    ),
  };
}
