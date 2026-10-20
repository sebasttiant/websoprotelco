// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";

const repo = vi.hoisted(() => ({
  findCommercialReport: vi.fn(),
  findStatusBreakdown: vi.fn(),
  findDailyTrend: vi.fn(),
  findMonthlyRevenue: vi.fn(),
  findTopProducts: vi.fn(),
  findCatalogReport: vi.fn(),
  findProductsByCategory: vi.fn(),
  findLeadsByStatus: vi.fn(),
  findLeadsBySource: vi.fn(),
  countLeadsInRange: vi.fn(),
}));

vi.mock("@/domains/reports/repository", () => repo);

import { loadDashboardData } from "@/domains/reports/dashboard-query";

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T15:00:00.000Z"));
  repo.findCommercialReport.mockResolvedValue("commercial");
  repo.findStatusBreakdown.mockImplementation(async (kind: string) => [`${kind}-status`]);
  repo.findDailyTrend.mockResolvedValue("trend");
  repo.findMonthlyRevenue.mockResolvedValue("monthly");
  repo.findTopProducts.mockResolvedValue("top");
  repo.findCatalogReport.mockResolvedValue("catalog");
  repo.findProductsByCategory.mockResolvedValue("categories");
  repo.findLeadsByStatus.mockResolvedValue("leads-status");
  repo.findLeadsBySource.mockResolvedValue("leads-source");
  repo.countLeadsInRange.mockResolvedValue(7);
});

describe("loadDashboardData", () => {
  test("queries every aggregate with the range bound and returns the raw rows", async () => {
    const from = new Date("2026-10-14T00:00:00.000Z");
    const data = await loadDashboardData("7");

    expect(data).toEqual({
      from,
      toIso: "2026-10-20T15:00:00.000Z",
      trendFrom: from,
      commercial: "commercial",
      ordersByStatus: ["order-status"],
      quotesByStatus: ["quote-status"],
      dailyTrendRaw: "trend",
      monthlyRevenue: "monthly",
      topProducts: "top",
      catalog: "catalog",
      productsByCategory: "categories",
      leadsByStatus: "leads-status",
      leadsBySource: "leads-source",
      leadTotal: 7,
    });
    expect(repo.findCommercialReport).toHaveBeenCalledWith(from);
    expect(repo.findStatusBreakdown).toHaveBeenNthCalledWith(1, "order", from);
    expect(repo.findStatusBreakdown).toHaveBeenNthCalledWith(2, "quote", from);
    expect(repo.findMonthlyRevenue).toHaveBeenCalledWith(6);
    expect(repo.findTopProducts).toHaveBeenCalledWith(from, 10);
    expect(repo.findCatalogReport).toHaveBeenCalledWith(5);
  });

  test("uses a null bound and a 90-day trend start for all-time", async () => {
    const data = await loadDashboardData("all");

    expect(data.from).toBeNull();
    expect(data.trendFrom).toEqual(new Date("2026-07-23T00:00:00.000Z"));
    expect(repo.findDailyTrend).toHaveBeenCalledWith(data.trendFrom);
    expect(repo.countLeadsInRange).toHaveBeenCalledWith(null);
  });

  test("starts all eleven queries concurrently before any resolves", async () => {
    repo.findCommercialReport.mockReturnValue(new Promise(() => undefined));

    void loadDashboardData("30");
    await Promise.resolve();

    const started = Object.values(repo).reduce((sum, mock) => sum + mock.mock.calls.length, 0);
    expect(started).toBe(11);
  });

  test("propagates the first query failure", async () => {
    const failure = new Error("db down");
    repo.findTopProducts.mockRejectedValue(failure);

    await expect(loadDashboardData("30")).rejects.toBe(failure);
  });
});
