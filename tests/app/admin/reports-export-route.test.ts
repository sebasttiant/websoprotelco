// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

import type { SessionUser } from "@/server/auth/session";

const { mockGetCurrentUser, mockBuildReportCsv, mockBuildReportWorkbook } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockBuildReportCsv: vi.fn(),
  mockBuildReportWorkbook: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/domains/reports", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/domains/reports")>()),
  buildReportCsv: mockBuildReportCsv,
  buildReportWorkbook: mockBuildReportWorkbook,
}));

import { GET } from "@/app/admin/reports/export/route";

const adminUser: SessionUser = { id: "admin-1", email: "admin@soprotelco.test", role: "admin" };
const staffUser: SessionUser = { id: "staff-1", email: "staff@soprotelco.test", role: "staff" };
const customerUser: SessionUser = { id: "customer-1", email: "customer@soprotelco.test", role: "customer" };

function exportRequest(format: "csv" | "xlsx"): Request {
  return new Request(`http://localhost:8585/admin/reports/export?range=all&section=summary&format=${format}`);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /admin/reports/export", () => {
  test("returns 401 and builds nothing without a session", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET(exportRequest("csv"));

    await expect(response.json()).resolves.toEqual({ error: "Se requiere iniciar sesión." });
    expect(response.status).toBe(401);
    expect(mockBuildReportCsv).not.toHaveBeenCalled();
  });

  test.each(["csv", "xlsx"] as const)("returns 403 and builds no %s for a customer", async (format) => {
    mockGetCurrentUser.mockResolvedValue(customerUser);

    const response = await GET(exportRequest(format));

    await expect(response.json()).resolves.toEqual({ error: "Necesitás permiso para ver reportes." });
    expect(response.status).toBe(403);
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(mockBuildReportCsv).not.toHaveBeenCalled();
    expect(mockBuildReportWorkbook).not.toHaveBeenCalled();
  });

  test("serves the CSV to a role that may read quotes", async () => {
    mockGetCurrentUser.mockResolvedValue(staffUser);
    mockBuildReportCsv.mockResolvedValue({ filename: "resumen.csv", body: "metric,value\n" });

    const response = await GET(exportRequest("csv"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="resumen.csv"');
    await expect(response.text()).resolves.toBe("metric,value\n");
    expect(mockBuildReportCsv).toHaveBeenCalledWith("all", "summary");
  });

  test("serves the workbook to an admin", async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser);
    mockBuildReportWorkbook.mockResolvedValue({
      filename: "reporte.xlsx",
      body: Buffer.from("PK"),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const response = await GET(exportRequest("xlsx"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("spreadsheetml");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mockBuildReportWorkbook).toHaveBeenCalledWith("all", "summary");
  });
});
