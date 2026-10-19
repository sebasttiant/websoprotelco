/**
 * Excel (.xlsx) export for admin reports — multi-sheet when section=all,
 * single sheet for staged exports. Dynamic exceljs import keeps the static
 * graph light (same pattern as drogueria reports-export).
 */

import { formatCurrencyCents, formatDate, leadSourceLabel, leadStatusLabel, quoteStatusLabel } from "@/lib/presentation";

import * as repository from "./repository";
import { rangeStartDate, type FullAdminReport, type ReportExportSection, type ReportRange } from "./schemas";
import { getFullAdminReport } from "./service";

const HEADER_FILL = "FF0B3B6A"; // brand-navy
const HEADER_FONT = "FFFFFFFF";

const RANGE_LABELS: Record<ReportRange, string> = {
  "7": "Últimos 7 días",
  "30": "Últimos 30 días",
  "90": "Últimos 90 días",
  all: "Todo el historial",
};

function styleHeader(row: import("exceljs").Row): void {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL },
    };
  });
}

function addSheetTitle(
  ws: import("exceljs").Worksheet,
  title: string,
  range: ReportRange,
  report: FullAdminReport,
): void {
  const heading = ws.addRow([title]);
  heading.font = { bold: true, size: 14 };
  ws.addRow([`Período: ${RANGE_LABELS[range]}`]);
  ws.addRow([
    `Desde: ${report.fromIso ? formatDate(report.fromIso) : "inicio"} · Hasta: ${formatDate(report.toIso)}`,
  ]);
  ws.addRow([`Generado: ${formatDate(new Date())}`]);
  ws.addRow([]);
}

async function fillResumen(ws: import("exceljs").Worksheet, report: FullAdminReport, range: ReportRange): Promise<void> {
  ws.columns = [{ width: 28 }, { width: 18 }, { width: 14 }];
  addSheetTitle(ws, "SOPROTELCO — Resumen", range, report);

  styleHeader(ws.addRow(["Métrica comercial", "Valor", "Nota"]));
  ws.addRow(["Ingresos ganados", formatCurrencyCents(report.commercial.revenueCents), ""]);
  ws.addRow(["Pedidos", report.commercial.orders, `${report.commercial.pendingOrders} pendientes`]);
  ws.addRow(["Cotizaciones", report.commercial.quotes, `${report.commercial.openQuotes} abiertas`]);
  ws.addRow(["Ganados", report.commercial.wonOrders, ""]);
  ws.addRow(["Perdidos", report.commercial.lostOrders, ""]);
  ws.addRow(["Conversión %", report.commercial.conversionPercent, "Ganados / (ganados + perdidos)"]);
  ws.addRow([]);

  styleHeader(ws.addRow(["Catálogo", "Valor", ""]));
  ws.addRow(["Productos", report.catalog.total, `${report.catalog.active} activos`]);
  ws.addRow(["Sin imagen", report.catalog.missingImage, ""]);
  ws.addRow(["Stock bajo", report.catalog.lowStock, ""]);
  ws.addRow(["Sin stock", report.catalog.outOfStock, ""]);
  ws.addRow(["Valor inventario", formatCurrencyCents(report.catalog.catalogValueCents), "Estimado"]);
  ws.addRow(["Leads (período)", report.leadTotal, ""]);
}

async function fillDistribution(ws: import("exceljs").Worksheet, report: FullAdminReport, range: ReportRange): Promise<void> {
  ws.columns = [{ width: 24 }, { width: 12 }, { width: 10 }];
  addSheetTitle(ws, "Distribución por estado", range, report);

  styleHeader(ws.addRow(["Pedidos — estado", "Cantidad", "%"]));
  for (const slice of report.ordersSlices) {
    ws.addRow([slice.label, slice.count, slice.percent]);
  }
  ws.addRow([]);

  styleHeader(ws.addRow(["Cotizaciones — estado", "Cantidad", "%"]));
  for (const slice of report.quotesSlices) {
    ws.addRow([slice.label, slice.count, slice.percent]);
  }
  ws.addRow([]);

  styleHeader(ws.addRow(["Leads — estado", "Cantidad", "%"]));
  for (const slice of report.leadsSlices) {
    ws.addRow([slice.label, slice.count, slice.percent]);
  }
  ws.addRow([]);

  styleHeader(ws.addRow(["Leads — origen", "Cantidad", "%"]));
  for (const slice of report.leadSourceSlices) {
    ws.addRow([slice.label, slice.count, slice.percent]);
  }
}

async function fillTrend(ws: import("exceljs").Worksheet, report: FullAdminReport, range: ReportRange): Promise<void> {
  ws.columns = [{ width: 14 }, { width: 12 }, { width: 14 }];
  addSheetTitle(ws, "Tendencia diaria", range, report);
  styleHeader(ws.addRow(["Fecha", "Pedidos", "Cotizaciones"]));
  for (const point of report.dailyTrend) {
    if (point.orders === 0 && point.quotes === 0) continue;
    ws.addRow([point.date, point.orders, point.quotes]);
  }
}

async function fillOrders(
  ws: import("exceljs").Worksheet,
  report: FullAdminReport,
  range: ReportRange,
  kind: "order" | "quote",
): Promise<void> {
  const from = rangeStartDate(range);
  const rows = await repository.findExportOrders(from, kind);
  const title = kind === "order" ? "Pedidos" : "Cotizaciones";

  ws.columns = [
    { width: 16 },
    { width: 14 },
    { width: 22 },
    { width: 26 },
    { width: 20 },
    { width: 14 },
    { width: 10 },
    { width: 14 },
  ];
  addSheetTitle(ws, title, range, report);
  styleHeader(
    ws.addRow(["Referencia", "Estado", "Contacto", "Email", "Empresa", "Creado", "Ítems", "Total"]),
  );

  for (const row of rows) {
    ws.addRow([
      row.reference,
      quoteStatusLabel(row.status),
      row.contactName,
      row.contactEmail,
      row.companyName,
      formatDate(row.createdAt),
      row.itemCount,
      kind === "order" && row.totalCents != null ? formatCurrencyCents(row.totalCents) : "",
    ]);
  }
}

async function fillCatalog(ws: import("exceljs").Worksheet, report: FullAdminReport, range: ReportRange): Promise<void> {
  ws.columns = [{ width: 28 }, { width: 14 }];
  addSheetTitle(ws, "Catálogo", range, report);
  styleHeader(ws.addRow(["Métrica", "Valor"]));
  ws.addRow(["Total", report.catalog.total]);
  ws.addRow(["Activos", report.catalog.active]);
  ws.addRow(["Inactivos", report.catalog.inactive]);
  ws.addRow(["Sin imagen", report.catalog.missingImage]);
  ws.addRow(["Stock bajo", report.catalog.lowStock]);
  ws.addRow(["Sin stock", report.catalog.outOfStock]);
  ws.addRow(["Valor estimado", formatCurrencyCents(report.catalog.catalogValueCents)]);
  ws.addRow([]);
  styleHeader(ws.addRow(["Categoría", "Productos"]));
  for (const row of report.productsByCategory) {
    ws.addRow([row.name, row.count]);
  }
  ws.addRow([]);
  styleHeader(ws.addRow(["Top productos", "Cant.", "Ingresos"]));
  for (const row of report.topProducts) {
    ws.addRow([row.name, row.quantity, formatCurrencyCents(row.revenueCents)]);
  }
}

async function fillLeads(ws: import("exceljs").Worksheet, report: FullAdminReport, range: ReportRange): Promise<void> {
  ws.columns = [{ width: 18 }, { width: 24 }, { width: 12 }];
  addSheetTitle(ws, "Leads", range, report);
  styleHeader(ws.addRow(["Dimensión", "Clave", "Cantidad"]));
  for (const row of report.leadsByStatus) {
    ws.addRow(["estado", leadStatusLabel(row.status), row.count]);
  }
  for (const row of report.leadsBySource) {
    ws.addRow(["origen", leadSourceLabel(row.name), row.count]);
  }
}

export async function buildReportWorkbook(
  range: ReportRange,
  section: ReportExportSection,
): Promise<{ filename: string; body: Buffer; contentType: string }> {
  const report = await getFullAdminReport(range);
  const stamp = new Date().toISOString().slice(0, 10);
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "SOPROTELCO";
  wb.created = new Date();

  if (section === "all" || section === "summary") {
    await fillResumen(wb.addWorksheet("Resumen"), report, range);
  }
  if (section === "all") {
    await fillDistribution(wb.addWorksheet("Distribución"), report, range);
    await fillTrend(wb.addWorksheet("Tendencia"), report, range);
  }
  if (section === "all" || section === "orders") {
    await fillOrders(wb.addWorksheet("Pedidos"), report, range, "order");
  }
  if (section === "all" || section === "quotes") {
    await fillOrders(wb.addWorksheet("Cotizaciones"), report, range, "quote");
  }
  if (section === "all" || section === "catalog") {
    await fillCatalog(wb.addWorksheet("Catálogo"), report, range);
  }
  if (section === "all" || section === "leads") {
    await fillLeads(wb.addWorksheet("Leads"), report, range);
  }

  // Staged summary alone also gets distribution for a useful one-sheet+ context
  if (section === "summary") {
    await fillDistribution(wb.addWorksheet("Distribución"), report, range);
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const slug =
    section === "all"
      ? "completo"
      : section === "summary"
        ? "resumen"
        : section === "orders"
          ? "pedidos"
          : section === "quotes"
            ? "cotizaciones"
            : section === "catalog"
              ? "catalogo"
              : "leads";

  return {
    filename: `soprotelco-${slug}-${stamp}.xlsx`,
    body: buffer,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}
