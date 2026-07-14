// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock("@/server/db/pool", () => ({
  query: mockQuery,
}));

import {
  getCurrentStock,
  getLowStockProducts,
  getMovementHistory,
  MOVEMENT_PAGE_SIZE,
  recordMovement,
} from "@/domains/inventory/service";

const productId = "33333333-3333-4333-8333-333333333333";
const userId = "11111111-1111-4111-8111-111111111111";
const movementId = "44444444-4444-4444-8444-444444444444";

afterEach(() => {
  vi.clearAllMocks();
});

describe("recordMovement", () => {
  test("inserts a stock movement bound to the acting user", async () => {
    mockQuery.mockResolvedValue([]);

    await recordMovement(
      { productId, movementType: "sale", quantity: -3, notes: "Sold at the counter" },
      userId,
    );

    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO stock_movements");
    expect(values).toEqual([productId, "sale", -3, "Sold at the counter", userId]);
  });

  test("defaults missing notes to null", async () => {
    mockQuery.mockResolvedValue([]);

    await recordMovement({ productId, movementType: "purchase", quantity: 20 }, null);

    const [, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(values).toEqual([productId, "purchase", 20, null, null]);
  });
});

describe("getCurrentStock", () => {
  test("returns the summed stock for a product", async () => {
    mockQuery.mockResolvedValue([{ current_stock: 7 }]);

    const stock = await getCurrentStock(productId);

    expect(stock).toBe(7);
    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("SUM(quantity)");
    expect(sql).toContain("::bigint");
    expect(sql).not.toContain("SUM(quantity), 0)::int");
    expect(values).toEqual([productId]);
  });

  test("returns 0 when the product has no movements", async () => {
    mockQuery.mockResolvedValue([]);

    expect(await getCurrentStock(productId)).toBe(0);
  });

  test("coerces a bigint-as-string row to a number", async () => {
    mockQuery.mockResolvedValue([{ current_stock: "7" }]);

    const stock = await getCurrentStock(productId);

    expect(stock).toBe(7);
    expect(typeof stock).toBe("number");
  });
});

describe("getMovementHistory", () => {
  test("maps movement rows to camelCase and returns pagination metadata", async () => {
    mockQuery
      .mockResolvedValueOnce([
        {
          id: movementId,
          product_id: productId,
          product_name: "Fiber Router",
          movement_type: "sale",
          quantity: -3,
          notes: "Sold at the counter",
          user_id: userId,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([{ total: 1 }]);

    const result = await getMovementHistory(productId);

    expect(result).toEqual({
      movements: [
        {
          id: movementId,
          productId,
          productName: "Fiber Router",
          movementType: "sale",
          quantity: -3,
          notes: "Sold at the counter",
          userId,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: MOVEMENT_PAGE_SIZE,
    });
  });

  test("clamps a non-positive page to page 1", async () => {
    mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

    const result = await getMovementHistory(productId, -5);

    expect(result.page).toBe(1);
    const [, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(values).toEqual([productId, MOVEMENT_PAGE_SIZE, 0]);
  });

  test("computes the offset for a later page", async () => {
    mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

    await getMovementHistory(productId, 3);

    const [, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(values).toEqual([productId, MOVEMENT_PAGE_SIZE, MOVEMENT_PAGE_SIZE * 2]);
  });
});

describe("getLowStockProducts", () => {
  test("maps product stock rows to camelCase", async () => {
    mockQuery.mockResolvedValue([
      { product_id: productId, sku: "SKU-1", name: "Fiber Router", current_stock: 3 },
    ]);

    const result = await getLowStockProducts(10);

    expect(result).toEqual([{ productId, sku: "SKU-1", name: "Fiber Router", currentStock: 3 }]);
    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("HAVING COALESCE(SUM(m.quantity), 0) < $1");
    expect(sql).toContain("::bigint");
    expect(sql).not.toContain("SUM(m.quantity), 0)::int");
    expect(values).toEqual([10]);
  });

  test("defaults to the global low stock threshold when none is provided", async () => {
    mockQuery.mockResolvedValue([]);

    await getLowStockProducts();

    const [, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(values).toEqual([10]);
  });

  test("coerces a bigint-as-string current_stock row to a number", async () => {
    mockQuery.mockResolvedValue([
      { product_id: productId, sku: "SKU-1", name: "Fiber Router", current_stock: "3" },
    ]);

    const result = await getLowStockProducts(10);

    expect(result).toEqual([{ productId, sku: "SKU-1", name: "Fiber Router", currentStock: 3 }]);
    expect(typeof result[0]?.currentStock).toBe("number");
  });
});
