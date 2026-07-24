// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockQuery, mockClientQuery, mockWithTransaction } = vi.hoisted(() => {
  const mockClientQuery = vi.fn();

  return {
    mockQuery: vi.fn(),
    mockClientQuery,
    // Runs the handler against a stub client so the assertions below see the real statement
    // sequence. Commit/rollback semantics belong to pool.ts and are not re-litigated here.
    mockWithTransaction: vi.fn(async (handler: (client: { query: unknown }) => Promise<unknown>) =>
      handler({ query: mockClientQuery }),
    ),
  };
});

vi.mock("@/server/db/pool", () => ({
  query: mockQuery,
  withTransaction: mockWithTransaction,
}));

import { insertOrder, UnavailableProductError } from "@/domains/quote-order/repository";

const productA = "11111111-1111-4111-8111-111111111111";
const productB = "44444444-4444-4444-8444-444444444444";
const orderId = "99999999-9999-4999-8999-999999999999";
const userId = "22222222-2222-4222-8222-222222222222";

afterEach(() => {
  vi.clearAllMocks();
});

function baseOrder(items: readonly { productId: string; quantity: number }[]) {
  return {
    reference: "WEB-TEST-0001",
    contactName: "Jane Buyer",
    contactEmail: "jane@example.test",
    contactPhone: "+57 300 000 0000",
    message: "",
    userId,
    items,
  };
}

/** Products lookup, then the order insert, then one insert per line. */
function stubHappyPath(products: readonly { id: string; name: string; price_cents: string }[]): void {
  mockClientQuery.mockResolvedValueOnce(products);
  mockClientQuery.mockResolvedValueOnce([{ id: orderId }]);
  mockClientQuery.mockResolvedValue([]);
}

describe("insertOrder pricing", () => {
  test("prices every line from the products table, never from the caller", async () => {
    stubHappyPath([{ id: productA, name: "Switch PoE+ 8 puertos", price_cents: "69900000" }]);

    // A tampered cart would carry priceCents: 1 here. The input type has no price field at
    // all, so there is nothing for the caller to lie about in the first place.
    const result = await insertOrder(baseOrder([{ productId: productA, quantity: 2 }]));

    expect(result.totalCents).toBe(139800000);

    const itemInsert = mockClientQuery.mock.calls[2] as [string, unknown[]];
    expect(itemInsert[0]).toContain("INSERT INTO quote_request_items");
    // unit_price_cents and product_name are the values read back from `products`.
    expect(itemInsert[1][4]).toBe(69900000);
    expect(itemInsert[1][5]).toBe("Switch PoE+ 8 puertos");
  });

  test("sums the total across several lines", async () => {
    stubHappyPath([
      { id: productA, name: "Switch PoE+ 8 puertos", price_cents: "69900000" },
      { id: productB, name: "Conversor de medio", price_cents: "14500000" },
    ]);

    const result = await insertOrder(
      baseOrder([
        { productId: productA, quantity: 2 },
        { productId: productB, quantity: 1 },
      ]),
    );

    expect(result.totalCents).toBe(154300000);
  });

  test("only queries active products", async () => {
    stubHappyPath([{ id: productA, name: "Switch PoE+ 8 puertos", price_cents: "69900000" }]);

    await insertOrder(baseOrder([{ productId: productA, quantity: 1 }]));

    const lookup = mockClientQuery.mock.calls[0] as [string, unknown[]];
    expect(lookup[0]).toContain("is_active = true");
  });

  test("records the order with kind 'order' and the caller's ownership binding", async () => {
    stubHappyPath([{ id: productA, name: "Switch PoE+ 8 puertos", price_cents: "69900000" }]);

    await insertOrder(baseOrder([{ productId: productA, quantity: 1 }]));

    const orderInsert = mockClientQuery.mock.calls[1] as [string, unknown[]];
    expect(orderInsert[0]).toContain("'order'");
    expect(orderInsert[1][5]).toBe(userId);
  });
});

describe("insertOrder rejections", () => {
  test("rejects the whole order when a product is unknown or inactive", async () => {
    // Two ids requested, one row returned: the other is gone or deactivated.
    mockClientQuery.mockResolvedValueOnce([{ id: productA, name: "Switch", price_cents: "69900000" }]);

    await expect(
      insertOrder(
        baseOrder([
          { productId: productA, quantity: 1 },
          { productId: productB, quantity: 1 },
        ]),
      ),
    ).rejects.toBeInstanceOf(UnavailableProductError);

    // Nothing was written: silently dropping the missing line would confirm an order the
    // customer never placed, for less than they asked for.
    expect(mockClientQuery).toHaveBeenCalledTimes(1);
  });

  test("accepts a repeated product id without treating it as a missing product", async () => {
    stubHappyPath([{ id: productA, name: "Switch PoE+ 8 puertos", price_cents: "69900000" }]);

    // Two lines, one distinct id. Comparing the lookup against the raw length instead of the
    // distinct set would reject this valid order.
    const result = await insertOrder(
      baseOrder([
        { productId: productA, quantity: 1 },
        { productId: productA, quantity: 3 },
      ]),
    );

    expect(result.totalCents).toBe(279600000);
  });

  test("refuses a total beyond the safe integer range instead of rounding it", async () => {
    stubHappyPath([{ id: productA, name: "Absurdly priced", price_cents: String(Number.MAX_SAFE_INTEGER) }]);

    await expect(insertOrder(baseOrder([{ productId: productA, quantity: 99 }]))).rejects.toThrow(
      /not representable/,
    );
  });
});
