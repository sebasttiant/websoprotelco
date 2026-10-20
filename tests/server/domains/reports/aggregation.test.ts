// @vitest-environment node
import { describe, expect, test } from "vitest";

import { assembleFullAdminReport, fillDailyTrend, namedToSlices, toSlices } from "@/domains/reports/aggregation";
import type { DashboardData } from "@/domains/reports/dashboard-query";
import { quoteStatusLabel } from "@/lib/presentation";

function dashboardData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    from: new Date("2026-10-14T00:00:00.000Z"),
    toIso: "2026-10-20T15:00:00.000Z",
    trendFrom: new Date("2026-10-14T00:00:00.000Z"),
    commercial: {
      orders: 1,
      quotes: 0,
      wonOrders: 0,
      lostOrders: 0,
      pendingOrders: 1,
      openQuotes: 0,
      revenueCents: 0,
      wonWithoutTotal: 0,
      conversionPercent: 0,
    },
    ordersByStatus: [{ status: "won", count: 1 }],
    quotesByStatus: [],
    dailyTrendRaw: [],
    monthlyRevenue: [],
    topProducts: [],
    catalog: {
      total: 0,
      active: 0,
      inactive: 0,
      missingImage: 0,
      lowStock: 0,
      outOfStock: 0,
      catalogValueCents: 0,
    },
    productsByCategory: [{ name: "Fusionadoras", count: 1 }],
    leadsByStatus: [],
    leadsBySource: [],
    leadTotal: 0,
    ...overrides,
  };
}

describe("toSlices", () => {
  test("rounds percent to one decimal and labels each status", () => {
    expect(
      toSlices(
        [
          { status: "won", count: 1 },
          { status: "lost", count: 2 },
        ],
        quoteStatusLabel,
      ),
    ).toEqual([
      { status: "won", label: quoteStatusLabel("won"), count: 1, percent: 33.3 },
      { status: "lost", label: quoteStatusLabel("lost"), count: 2, percent: 66.7 },
    ]);
  });

  test("reports zero percent when the total is zero", () => {
    expect(toSlices([{ status: "won", count: 0 }], (status) => status)[0]?.percent).toBe(0);
    expect(toSlices([], (status) => status)).toEqual([]);
  });
});

describe("namedToSlices", () => {
  test("defaults the label to the name", () => {
    expect(namedToSlices([{ name: "Fusionadoras", count: 4 }])).toEqual([
      { status: "Fusionadoras", label: "Fusionadoras", count: 4, percent: 100 },
    ]);
  });

  test("uses the supplied label function", () => {
    expect(namedToSlices([{ name: "web", count: 1 }], (name) => name.toUpperCase())[0]?.label).toBe("WEB");
  });
});

describe("fillDailyTrend", () => {
  test("fills missing Bogota days and keeps the original point objects", () => {
    const point = { date: "2026-10-15", label: "10-15", orders: 4, quotes: 1 };
    const filled = fillDailyTrend(
      [point],
      new Date("2026-10-14T00:00:00.000Z"),
      new Date("2026-10-16T12:00:00.000Z"),
    );

    expect(filled.map((day) => day.date)).toEqual(["2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]);
    expect(filled[2]).toBe(point);
    expect(filled[0]).toEqual({ date: "2026-10-13", label: "10-13", orders: 0, quotes: 0 });
  });

  test("never emits more than the guarded window", () => {
    const filled = fillDailyTrend([], new Date("2025-01-01T00:00:00.000Z"), new Date("2026-10-20T00:00:00.000Z"));

    expect(filled).toHaveLength(97);
  });
});

describe("assembleFullAdminReport", () => {
  test("derives iso bounds, slices and a filled trend from queried data", () => {
    const data = dashboardData();
    const report = assembleFullAdminReport("7", data);

    expect(report.range).toBe("7");
    expect(report.fromIso).toBe("2026-10-14T00:00:00.000Z");
    expect(report.toIso).toBe("2026-10-20T15:00:00.000Z");
    expect(report.ordersSlices).toEqual([
      { status: "won", label: quoteStatusLabel("won"), count: 1, percent: 100 },
    ]);
    expect(report.categorySlices[0]?.label).toBe("Fusionadoras");
    expect(report.dailyTrend).toHaveLength(8);
    expect(report.ordersByStatus).toBe(data.ordersByStatus);
  });

  test("keeps fromIso null for the all-time range", () => {
    expect(assembleFullAdminReport("all", dashboardData({ from: null })).fromIso).toBeNull();
  });
});
