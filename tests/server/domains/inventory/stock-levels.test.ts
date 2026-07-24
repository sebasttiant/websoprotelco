// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock("@/server/db/pool", () => ({
  query: mockQuery,
}));

import { getStockLevels } from "@/domains/inventory/service";

afterEach(() => {
  mockQuery.mockReset();
});

function lastQuery(): [string, unknown[]] {
  return mockQuery.mock.calls[0] as [string, unknown[]];
}

describe("getStockLevels", () => {
  test("lists every active product with no search filter", async () => {
    mockQuery.mockResolvedValueOnce([]);

    await getStockLevels();

    const [sql, values] = lastQuery();
    expect(sql).toContain("WHERE p.is_active = true");
    // No extra AND clause and no bound parameters when nothing is searched.
    expect(sql).not.toContain("ILIKE");
    expect(values).toEqual([]);
  });

  test("filters on name and SKU when a term is given", async () => {
    mockQuery.mockResolvedValueOnce([]);

    await getStockLevels("fusion");

    const [sql, values] = lastQuery();
    expect(sql).toContain("p.name ILIKE $1");
    expect(sql).toContain("p.sku ILIKE $1");
    expect(values).toEqual(["%fusion%"]);
  });

  // A typed "%" must filter literally; unescaped it is a LIKE wildcard that matches every row
  // and silently disables the filter.
  test("escapes LIKE wildcards in the search term", async () => {
    mockQuery.mockResolvedValueOnce([]);

    await getStockLevels("50%");

    const [, values] = lastQuery();
    expect(values[0]).toBe("%50\\%%");
  });

  test("trims the term so surrounding spaces do not become a filter", async () => {
    mockQuery.mockResolvedValueOnce([]);

    await getStockLevels("   ");

    const [sql] = lastQuery();
    expect(sql).not.toContain("ILIKE");
  });

  test("maps the bigint stock string to a number", async () => {
    mockQuery.mockResolvedValueOnce([
      { product_id: "p1", sku: "FUS", name: "Fusionadora", current_stock: "19" },
    ]);

    const [row] = await getStockLevels();

    expect(row.currentStock).toBe(19);
    expect(typeof row.currentStock).toBe("number");
  });
});
