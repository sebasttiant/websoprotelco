// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockFindCommercialReport,
  mockFindStatusBreakdown,
  mockFindDailyTrend,
  mockFindMonthlyRevenue,
  mockFindTopProducts,
  mockFindCatalogReport,
  mockFindProductsByCategory,
  mockFindLeadsByStatus,
  mockFindLeadsBySource,
  mockCountLeadsInRange,
  mockFindExportOrders,
} = vi.hoisted(() => ({
  mockFindCommercialReport: vi.fn(),
  mockFindStatusBreakdown: vi.fn(),
  mockFindDailyTrend: vi.fn(),
  mockFindMonthlyRevenue: vi.fn(),
  mockFindTopProducts: vi.fn(),
  mockFindCatalogReport: vi.fn(),
  mockFindProductsByCategory: vi.fn(),
  mockFindLeadsByStatus: vi.fn(),
  mockFindLeadsBySource: vi.fn(),
  mockCountLeadsInRange: vi.fn(),
  mockFindExportOrders: vi.fn(),
}));

vi.mock("@/domains/reports/repository", () => ({
  findCommercialReport: mockFindCommercialReport,
  findStatusBreakdown: mockFindStatusBreakdown,
  findDailyTrend: mockFindDailyTrend,
  findMonthlyRevenue: mockFindMonthlyRevenue,
  findTopProducts: mockFindTopProducts,
  findCatalogReport: mockFindCatalogReport,
  findProductsByCategory: mockFindProductsByCategory,
  findLeadsByStatus: mockFindLeadsByStatus,
  findLeadsBySource: mockFindLeadsBySource,
  countLeadsInRange: mockCountLeadsInRange,
  findExportOrders: mockFindExportOrders,
}));

import { buildReportCsv, getFullAdminReport } from "@/domains/reports/service";

beforeEach(() => {
  vi.clearAllMocks();
  mockFindCommercialReport.mockResolvedValue({
    orders: 2,
    quotes: 1,
    wonOrders: 1,
    lostOrders: 0,
    pendingOrders: 1,
    openQuotes: 1,
    revenueCents: 1000,
    wonWithoutTotal: 0,
    conversionPercent: 100,
  });
  mockFindStatusBreakdown.mockResolvedValue([{ status: "won", count: 1 }]);
  mockFindDailyTrend.mockResolvedValue([{ day: "2026-10-01", orders: 1, quotes: 0 }]);
  mockFindMonthlyRevenue.mockResolvedValue([{ month: "2026-10", revenueCents: 1000, orderCount: 1 }]);
  mockFindTopProducts.mockResolvedValue([]);
  mockFindCatalogReport.mockResolvedValue({
    total: 4,
    active: 4,
    inactive: 0,
    missingImage: 4,
    lowStock: 0,
    outOfStock: 0,
    catalogValueCents: 0,
  });
  mockFindProductsByCategory.mockResolvedValue([{ name: "Fusionadoras", count: 2 }]);
  mockFindLeadsByStatus.mockResolvedValue([]);
  mockFindLeadsBySource.mockResolvedValue([]);
  mockCountLeadsInRange.mockResolvedValue(0);
  mockFindExportOrders.mockResolvedValue([
    {
      reference: "ORD-1",
      kind: "order",
      status: "won",
      contactName: "Ana",
      contactEmail: "ana@example.com",
      companyName: null,
      createdAt: "2026-10-01T00:00:00.000Z",
      itemCount: 1,
      totalCents: 1000,
    },
  ]);
});

describe("getFullAdminReport", () => {
  test("assembles parallel aggregates for a range", async () => {
    const report = await getFullAdminReport("30");

    expect(report.range).toBe("30");
    expect(report.commercial.orders).toBe(2);
    expect(report.catalog.total).toBe(4);
    expect(report.productsByCategory[0]?.name).toBe("Fusionadoras");
    expect(mockFindCommercialReport).toHaveBeenCalledOnce();
  });
});

describe("buildReportCsv", () => {
  test("builds a summary CSV with KPI rows", async () => {
    const file = await buildReportCsv("30", "summary");

    expect(file.filename).toMatch(/^soprotelco-resumen-/);
    expect(file.body).toContain("orders,2");
    expect(file.body).toContain("revenue_cents,1000");
  });

  test("builds an orders CSV from export rows", async () => {
    const file = await buildReportCsv("all", "orders");

    expect(file.filename).toMatch(/^soprotelco-pedidos-/);
    expect(file.body).toContain("ORD-1");
    expect(file.body).toContain("ana@example.com");
    expect(mockFindExportOrders).toHaveBeenCalledWith(null, "order");
  });
});
