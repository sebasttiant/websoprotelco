// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockFindExportOrders } = vi.hoisted(() => ({ mockFindExportOrders: vi.fn() }));

vi.mock("@/domains/reports/repository", () => ({ findExportOrders: mockFindExportOrders }));

import { csvEscape, serializeReportCsv, toCsv } from "@/domains/reports/csv-export";
import type { FullAdminReport } from "@/domains/reports/schemas";

const report: FullAdminReport = {
  range: "30",
  fromIso: "2026-09-21T00:00:00.000Z",
  toIso: "2026-10-20T15:00:00.000Z",
  commercial: {
    orders: 2,
    quotes: 1,
    wonOrders: 1,
    lostOrders: 0,
    pendingOrders: 1,
    openQuotes: 1,
    revenueCents: 1000,
    wonWithoutTotal: 0,
    conversionPercent: 100,
  },
  ordersByStatus: [],
  quotesByStatus: [],
  ordersSlices: [],
  quotesSlices: [],
  leadsSlices: [],
  leadSourceSlices: [],
  categorySlices: [],
  dailyTrend: [],
  monthlyRevenue: [],
  topProducts: [],
  catalog: {
    total: 4,
    active: 3,
    inactive: 1,
    missingImage: 2,
    lowStock: 1,
    outOfStock: 0,
    catalogValueCents: 500,
  },
  productsByCategory: [{ name: "Fusionadoras", count: 2 }],
  leadsByStatus: [{ status: "new", count: 2 }],
  leadsBySource: [{ name: "web", count: 5 }],
  leadTotal: 7,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T15:00:00.000Z"));
  mockFindExportOrders.mockResolvedValue([]);
});

describe("csvEscape", () => {
  test("quotes only values with commas, quotes or line breaks", () => {
    expect(csvEscape("plain")).toBe("plain");
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("a\nb")).toBe('"a\nb"');
    expect(csvEscape("a\rb")).toBe('"a\rb"');
  });

  test("renders nullish as empty and numbers as text", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
    expect(csvEscape(0)).toBe("0");
  });
});

describe("toCsv", () => {
  test("joins rows with LF and ends with a trailing newline, no BOM", () => {
    const csv = toCsv(["a", "b"], [[1, "x,y"]]);

    expect(csv).toBe('a,b\n1,"x,y"\n');
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
  });

  test("emits only the header when there are no rows", () => {
    expect(toCsv(["a"], [])).toBe("a\n");
  });
});

describe("serializeReportCsv", () => {
  test("serializes the leads section from the loaded report without querying orders", async () => {
    const file = await serializeReportCsv(report, "30", "leads");

    expect(file).toEqual({
      filename: "soprotelco-leads-2026-10-20.csv",
      body: "dimension,key,count\nstatus,new,2\nsource,web,5\n",
    });
    expect(mockFindExportOrders).not.toHaveBeenCalled();
  });

  test("serializes the catalog section including category rows", async () => {
    const file = await serializeReportCsv(report, "30", "catalog");

    expect(file.filename).toBe("soprotelco-catalogo-2026-10-20.csv");
    expect(file.body).toContain("inactive,1\n");
    expect(file.body).toContain("category:Fusionadoras,2\n");
  });

  test("queries export rows with the range bound for the orders section", async () => {
    const file = await serializeReportCsv(report, "7", "orders");

    expect(file.filename).toBe("soprotelco-pedidos-2026-10-20.csv");
    expect(mockFindExportOrders).toHaveBeenCalledOnce();
    expect(mockFindExportOrders).toHaveBeenCalledWith(new Date("2026-10-14T00:00:00.000Z"), "order");
  });

  test("queries orders then quotes sequentially for the all section", async () => {
    const file = await serializeReportCsv(report, "all", "all");

    expect(file.filename).toBe("soprotelco-reporte-completo-2026-10-20.csv");
    expect(mockFindExportOrders).toHaveBeenNthCalledWith(1, null, "order");
    expect(mockFindExportOrders).toHaveBeenNthCalledWith(2, null, "quote");
  });
});
