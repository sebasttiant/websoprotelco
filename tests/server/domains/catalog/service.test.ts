// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock("@/server/db/pool", () => ({
  query: mockQuery,
}));

import { getCategories, getFeaturedProducts, getProductBySlug, getProducts } from "@/domains/catalog/service";

afterEach(() => {
  vi.clearAllMocks();
});

describe("getProducts", () => {
  test("only queries active products for the public listing", async () => {
    mockQuery.mockResolvedValue([]);

    await getProducts();

    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("p.is_active = true");
  });

  test("maps a row into a ProductSummary, inferring brand and stock status", async () => {
    mockQuery.mockResolvedValue([{
      id: "11111111-1111-4111-8111-111111111111",
      slug: "fusion-splicer",
      sku: "SP-200",
      name: "Fusion Splicer Pro",
      description: "Precision fiber splicing tool",
      price_cents: "450000",
      currency: "COP",
      category_name: null,
      category_slug: null,
      brand: null,
      image_url: null,
      stock_quantity: 3,
    }]);

    const [product] = await getProducts();

    expect(product).toMatchObject({
      priceCents: 450000,
      categoryName: "Connectivity",
      categorySlug: "connectivity",
      brand: "Fusion",
      inStock: true,
    });
  });

  test("marks a product out of stock when stock_quantity is zero", async () => {
    mockQuery.mockResolvedValue([{
      id: "11111111-1111-4111-8111-111111111111",
      slug: "sp-1",
      sku: "SP-1",
      name: "Tool",
      description: "",
      price_cents: "1000",
      currency: "COP",
      category_name: "Fiber",
      category_slug: "fiber",
      brand: "SOPROTELCO",
      image_url: null,
      stock_quantity: 0,
    }]);

    const [product] = await getProducts();

    expect(product?.inStock).toBe(false);
  });
});

describe("getFeaturedProducts", () => {
  test("limits the query to active products only", async () => {
    mockQuery.mockResolvedValue([]);

    await getFeaturedProducts(6);

    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("p.is_active = true");
    expect(values).toEqual([6]);
  });
});

describe("getProductBySlug", () => {
  test("returns null when the product row is missing timestamps", async () => {
    mockQuery.mockResolvedValue([]);

    const product = await getProductBySlug("missing");

    expect(product).toBeNull();
  });

  test("maps a full row into a ProductDetail", async () => {
    mockQuery.mockResolvedValue([{
      id: "11111111-1111-4111-8111-111111111111",
      slug: "fusion-splicer",
      sku: "SP-200",
      name: "Fusion Splicer Pro",
      description: "Precision fiber splicing tool",
      price_cents: "450000",
      currency: "COP",
      category_name: "Fiber",
      category_slug: "fiber",
      brand: "SOPROTELCO",
      image_url: "/uploads/splicer.png",
      stock_quantity: 3,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    }]);

    const product = await getProductBySlug("fusion-splicer");

    expect(product).toMatchObject({
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      imageUrl: "/uploads/splicer.png",
    });
  });
});

describe("getCategories", () => {
  test("orders categories by display_order", async () => {
    mockQuery.mockResolvedValue([]);

    await getCategories();

    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("ORDER BY display_order ASC, name ASC");
  });

  test("maps display_order into the position field", async () => {
    mockQuery.mockResolvedValue([
      { id: "1", slug: "fiber", name: "Fiber", display_order: 2, image_url: null },
      { id: "2", slug: "networking", name: "Networking", display_order: 1, image_url: null },
    ]);

    const categories = await getCategories();

    expect(categories.map((category) => category.position)).toEqual([2, 1]);
  });
});
