import { NextResponse } from "next/server";

import {
  buildReportCsv,
  buildReportWorkbook,
  isReportExportFormat,
  isReportExportSection,
  isReportRange,
  type ReportExportFormat,
  type ReportExportSection,
  type ReportRange,
} from "@/domains/reports";
import { getCurrentUser } from "@/server/auth/guards";
import { hasPermission } from "@/server/auth/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Se requiere iniciar sesión." }, { status: 401 });
  }

  if (!hasPermission(user.role, "quote:read")) {
    return NextResponse.json({ error: "Necesitás permiso para ver reportes." }, { status: 403 });
  }

  const url = new URL(request.url);
  const rawRange = url.searchParams.get("range") ?? "30";
  const rawSection = url.searchParams.get("section") ?? "summary";
  const rawFormat = url.searchParams.get("format") ?? "csv";
  const range: ReportRange = isReportRange(rawRange) ? rawRange : "30";
  const section: ReportExportSection = isReportExportSection(rawSection) ? rawSection : "summary";
  const format: ReportExportFormat = isReportExportFormat(rawFormat) ? rawFormat : "csv";

  if (format === "xlsx") {
    const { filename, body, contentType } = await buildReportWorkbook(range, section);
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const { filename, body } = await buildReportCsv(range, section);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
