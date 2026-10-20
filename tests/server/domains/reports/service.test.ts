// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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
import { leadSourceLabel, quoteStatusLabel } from "@/lib/presentation";

const NOW = new Date("2026-10-20T15:00:00.000Z");

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
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

afterEach(() => {
  vi.useRealTimers();
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

describe("getFullAdminReport contract", () => {
  test("passes the inclusive UTC-midnight lower bound and fixed limits to every query", async () => {
    const report = await getFullAdminReport("7");
    const from = new Date("2026-10-14T00:00:00.000Z");

    expect(report.fromIso).toBe("2026-10-14T00:00:00.000Z");
    expect(report.toIso).toBe("2026-10-20T15:00:00.000Z");
    expect(mockFindCommercialReport).toHaveBeenCalledWith(from);
    expect(mockFindStatusBreakdown).toHaveBeenNthCalledWith(1, "order", from);
    expect(mockFindStatusBreakdown).toHaveBeenNthCalledWith(2, "quote", from);
    expect(mockFindDailyTrend).toHaveBeenCalledWith(from);
    expect(mockFindMonthlyRevenue).toHaveBeenCalledWith(6);
    expect(mockFindTopProducts).toHaveBeenCalledWith(from, 10);
    expect(mockFindCatalogReport).toHaveBeenCalledWith(5);
    expect(mockFindProductsByCategory).toHaveBeenCalledWith();
    expect(mockFindLeadsByStatus).toHaveBeenCalledWith(from);
    expect(mockFindLeadsBySource).toHaveBeenCalledWith(from);
    expect(mockCountLeadsInRange).toHaveBeenCalledWith(from);
  });

  test("uses a null bound and a 90-day trend window for the all-time range", async () => {
    const report = await getFullAdminReport("all");

    expect(report.fromIso).toBeNull();
    expect(mockFindCommercialReport).toHaveBeenCalledWith(null);
    expect(mockFindTopProducts).toHaveBeenCalledWith(null, 10);
    expect(mockFindDailyTrend).toHaveBeenCalledWith(new Date("2026-07-23T00:00:00.000Z"));
  });

  test("builds rounded percent slices with presentation labels", async () => {
    mockFindStatusBreakdown.mockResolvedValue([
      { status: "won", count: 1 },
      { status: "lost", count: 2 },
    ]);
    mockFindLeadsBySource.mockResolvedValue([{ name: "web", count: 3 }]);

    const report = await getFullAdminReport("30");

    expect(report.ordersSlices).toEqual([
      { status: "won", label: quoteStatusLabel("won"), count: 1, percent: 33.3 },
      { status: "lost", label: quoteStatusLabel("lost"), count: 2, percent: 66.7 },
    ]);
    expect(report.quotesSlices).toEqual(report.ordersSlices);
    expect(report.leadSourceSlices).toEqual([
      { status: "web", label: leadSourceLabel("web"), count: 3, percent: 100 },
    ]);
    expect(report.categorySlices).toEqual([
      { status: "Fusionadoras", label: "Fusionadoras", count: 2, percent: 100 },
    ]);
  });

  test("returns empty slices with zero percent when there is no data", async () => {
    mockFindStatusBreakdown.mockResolvedValue([{ status: "won", count: 0 }]);
    mockFindProductsByCategory.mockResolvedValue([]);

    const report = await getFullAdminReport("30");

    expect(report.ordersSlices[0]?.percent).toBe(0);
    expect(report.categorySlices).toEqual([]);
    expect(report.leadsSlices).toEqual([]);
  });

  test("fills missing Bogota calendar days and keeps existing points", async () => {
    const point = { date: "2026-10-15", label: "10-15", orders: 4, quotes: 1 };
    mockFindDailyTrend.mockResolvedValue([point]);

    const report = await getFullAdminReport("7");

    expect(report.dailyTrend.map((day) => day.date)).toEqual([
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
      "2026-10-20",
    ]);
    expect(report.dailyTrend[2]).toBe(point);
    expect(report.dailyTrend[0]).toEqual({ date: "2026-10-13", label: "10-13", orders: 0, quotes: 0 });
  });

  test("propagates repository failures", async () => {
    const failure = new Error("db down");
    mockFindLeadsBySource.mockRejectedValue(failure);

    await expect(getFullAdminReport("30")).rejects.toBe(failure);
  });
});

describe("buildReportCsv contract", () => {
  const from = new Date("2026-09-21T00:00:00.000Z");

  test("pins the full summary body and filename", async () => {
    const file = await buildReportCsv("30", "summary");

    expect(file.filename).toBe("soprotelco-resumen-2026-10-20.csv");
    expect(file.body).toBe(
      [
        "metric,value",
        "range,30",
        "from,2026-09-21T00:00:00.000Z",
        "to,2026-10-20T15:00:00.000Z",
        "orders,2",
        "quotes,1",
        "won_orders,1",
        "lost_orders,0",
        "pending_orders,1",
        "open_quotes,1",
        "revenue_cents,1000",
        "conversion_percent,100",
        "catalog_total,4",
        "catalog_active,4",
        "catalog_missing_image,4",
        "catalog_low_stock,0",
        "catalog_out_of_stock,0",
        "catalog_value_cents,0",
        "leads_total,0",
        "",
      ].join("\n"),
    );
    expect(mockFindExportOrders).not.toHaveBeenCalled();
  });

  test("leaves the from cell empty for the all-time range", async () => {
    const file = await buildReportCsv("all", "summary");

    expect(file.body).toContain("\nfrom,\nto,2026-10-20T15:00:00.000Z\n");
  });

  test("combines every part for the all section in a fixed order", async () => {
    mockFindLeadsByStatus.mockResolvedValue([{ status: "new", count: 2 }]);
    mockFindExportOrders
      .mockResolvedValueOnce([
        {
          reference: "ORD-1",
          kind: "order",
          status: "won",
          contactName: "Ana",
          contactEmail: "ana@example.com",
          companyName: "Acme",
          createdAt: "2026-10-01T00:00:00.000Z",
          itemCount: 1,
          totalCents: 1000,
        },
      ])
      .mockResolvedValueOnce([
        {
          reference: "QUO-1",
          kind: "quote",
          status: "open",
          contactName: "Luis",
          contactEmail: "luis@example.com",
          companyName: null,
          createdAt: "2026-10-02T00:00:00.000Z",
          itemCount: 3,
          totalCents: null,
        },
      ]);

    const file = await buildReportCsv("30", "all");
    const parts = file.body.split("\n\n");

    expect(file.filename).toBe("soprotelco-reporte-completo-2026-10-20.csv");
    expect(mockFindExportOrders).toHaveBeenCalledTimes(2);
    expect(mockFindExportOrders).toHaveBeenNthCalledWith(1, from, "order");
    expect(mockFindExportOrders).toHaveBeenNthCalledWith(2, from, "quote");
    expect(parts).toHaveLength(5);
    expect(parts[0]).toMatch(/^metric,value\n/);
    expect(parts[1]).toBe(
      "reference,status,contact_name,contact_email,company,created_at,items,total_cents\n" +
        "ORD-1,won,Ana,ana@example.com,Acme,2026-10-01T00:00:00.000Z,1,1000",
    );
    expect(parts[2]).toBe(
      "reference,status,contact_name,contact_email,company,created_at,items\n" +
        "QUO-1,open,Luis,luis@example.com,,2026-10-02T00:00:00.000Z,3",
    );
    expect(parts[3]).toBe("category,products\nFusionadoras,2");
    expect(parts[4]).toBe("lead_status,count\nnew,2\n");
  });

  test("exports quotes without a total column", async () => {
    const file = await buildReportCsv("30", "quotes");

    expect(file.filename).toBe("soprotelco-cotizaciones-2026-10-20.csv");
    expect(file.body.split("\n")[0]).toBe(
      "reference,status,contact_name,contact_email,company,created_at,items",
    );
    expect(mockFindExportOrders).toHaveBeenCalledOnce();
    expect(mockFindExportOrders).toHaveBeenCalledWith(from, "quote");
  });

  test("exports the catalog section with category rows", async () => {
    const file = await buildReportCsv("30", "catalog");

    expect(file.filename).toBe("soprotelco-catalogo-2026-10-20.csv");
    expect(file.body).toBe(
      [
        "metric,value",
        "total,4",
        "active,4",
        "inactive,0",
        "missing_image,4",
        "low_stock,0",
        "out_of_stock,0",
        "catalog_value_cents,0",
        "category:Fusionadoras,2",
        "",
      ].join("\n"),
    );
    expect(mockFindExportOrders).not.toHaveBeenCalled();
  });

  test("exports the leads section by status then source", async () => {
    mockFindLeadsByStatus.mockResolvedValue([{ status: "new", count: 2 }]);
    mockFindLeadsBySource.mockResolvedValue([{ name: "web", count: 5 }]);

    const file = await buildReportCsv("30", "leads");

    expect(file.filename).toBe("soprotelco-leads-2026-10-20.csv");
    expect(file.body).toBe("dimension,key,count\nstatus,new,2\nsource,web,5\n");
  });

  test("emits only headers for empty data", async () => {
    mockFindExportOrders.mockResolvedValue([]);
    mockFindProductsByCategory.mockResolvedValue([]);

    const orders = await buildReportCsv("30", "orders");
    const leads = await buildReportCsv("30", "leads");

    expect(orders.body).toBe(
      "reference,status,contact_name,contact_email,company,created_at,items,total_cents\n",
    );
    expect(leads.body).toBe("dimension,key,count\n");
  });

  test("escapes commas, quotes and line breaks and blanks nulls", async () => {
    mockFindExportOrders.mockResolvedValue([
      {
        reference: "ORD-2",
        kind: "order",
        status: "won",
        contactName: 'Ana, "la jefa"',
        contactEmail: "ana@example.com",
        companyName: "Line\nBreak\rCo",
        createdAt: "2026-10-01T00:00:00.000Z",
        itemCount: 0,
        totalCents: null,
      },
    ]);

    const file = await buildReportCsv("30", "orders");

    expect(file.body.split("\n").slice(1).join("\n")).toBe(
      'ORD-2,won,"Ana, ""la jefa""",ana@example.com,"Line\nBreak\rCo",2026-10-01T00:00:00.000Z,0,\n',
    );
  });

  test("propagates export query failures after the report loaded", async () => {
    const failure = new Error("export failed");
    mockFindExportOrders.mockRejectedValue(failure);

    await expect(buildReportCsv("30", "orders")).rejects.toBe(failure);
    expect(mockFindCommercialReport).toHaveBeenCalledOnce();
  });

  test("does not run export queries when the report fails", async () => {
    const failure = new Error("db down");
    mockFindCatalogReport.mockRejectedValue(failure);

    await expect(buildReportCsv("30", "all")).rejects.toBe(failure);
    expect(mockFindExportOrders).not.toHaveBeenCalled();
  });
});
