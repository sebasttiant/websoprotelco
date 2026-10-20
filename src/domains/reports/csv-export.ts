import * as repository from "./repository";
import { rangeStartDate, type FullAdminReport, type ReportExportSection, type ReportRange } from "./schemas";

type CsvCell = string | number | null | undefined;

export interface CsvFile {
  filename: string;
  body: string;
}

const ORDER_HEADERS = [
  "reference",
  "status",
  "contact_name",
  "contact_email",
  "company",
  "created_at",
  "items",
  "total_cents",
];
const QUOTE_HEADERS = ORDER_HEADERS.slice(0, -1);

export function csvEscape(value: CsvCell): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function summaryCsv(report: FullAdminReport): string {
  return toCsv(
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
}

function exportRows(rows: repository.ExportOrderRow[], withTotal: boolean): CsvCell[][] {
  return rows.map((row) => {
    const cells: CsvCell[] = [
      row.reference,
      row.status,
      row.contactName,
      row.contactEmail,
      row.companyName,
      row.createdAt,
      row.itemCount,
    ];
    return withTotal ? [...cells, row.totalCents] : cells;
  });
}

async function ordersCsv(from: Date | null): Promise<string> {
  return toCsv(ORDER_HEADERS, exportRows(await repository.findExportOrders(from, "order"), true));
}

async function quotesCsv(from: Date | null): Promise<string> {
  return toCsv(QUOTE_HEADERS, exportRows(await repository.findExportOrders(from, "quote"), false));
}

function catalogCsv(report: FullAdminReport): string {
  return toCsv(
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
  );
}

function leadsCsv(report: FullAdminReport): string {
  return toCsv(
    ["dimension", "key", "count"],
    [
      ...report.leadsByStatus.map((row) => ["status", row.status, row.count]),
      ...report.leadsBySource.map((row) => ["source", row.name, row.count]),
    ],
  );
}

/** Serialize an already-loaded report; order/quote sections query export rows sequentially. */
export async function serializeReportCsv(
  report: FullAdminReport,
  range: ReportRange,
  section: ReportExportSection,
): Promise<CsvFile> {
  const stamp = new Date().toISOString().slice(0, 10);
  const from = rangeStartDate(range);

  if (section === "summary") {
    return { filename: `soprotelco-resumen-${stamp}.csv`, body: summaryCsv(report) };
  }

  if (section === "all") {
    const parts = [summaryCsv(report)];
    parts.push(await ordersCsv(from));
    parts.push(await quotesCsv(from));
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
    return { filename: `soprotelco-pedidos-${stamp}.csv`, body: await ordersCsv(from) };
  }

  if (section === "quotes") {
    return { filename: `soprotelco-cotizaciones-${stamp}.csv`, body: await quotesCsv(from) };
  }

  if (section === "catalog") {
    return { filename: `soprotelco-catalogo-${stamp}.csv`, body: catalogCsv(report) };
  }

  return { filename: `soprotelco-leads-${stamp}.csv`, body: leadsCsv(report) };
}
