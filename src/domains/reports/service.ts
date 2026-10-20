import { assembleFullAdminReport } from "./aggregation";
import { serializeReportCsv, type CsvFile } from "./csv-export";
import { loadDashboardData } from "./dashboard-query";
import type { FullAdminReport, ReportExportSection, ReportRange } from "./schemas";

export async function getFullAdminReport(range: ReportRange): Promise<FullAdminReport> {
  return assembleFullAdminReport(range, await loadDashboardData(range));
}

export async function buildReportCsv(range: ReportRange, section: ReportExportSection): Promise<CsvFile> {
  return serializeReportCsv(await getFullAdminReport(range), range, section);
}
