// @vitest-environment node
import { describe, expect, test } from "vitest";

import { isMovementType, isProductId, stockMovementInputSchema } from "@/domains/inventory/schemas";

const productId = "33333333-3333-4333-8333-333333333333";

describe("isMovementType", () => {
  test.each(["sale", "purchase", "adjustment", "return"])("accepts %s", (value) => {
    expect(isMovementType(value)).toBe(true);
  });

  test.each(["restock", "", "SALE"])("rejects %s", (value) => {
    expect(isMovementType(value)).toBe(false);
  });
});

describe("stockMovementInputSchema", () => {
  test("accepts a negative quantity for an outgoing sale", () => {
    const result = stockMovementInputSchema.safeParse({
      productId,
      movementType: "sale",
      quantity: -3,
      notes: "Sold at the counter",
    });

    expect(result.success).toBe(true);
  });

  test("accepts a positive quantity for an incoming purchase", () => {
    const result = stockMovementInputSchema.safeParse({
      productId,
      movementType: "purchase",
      quantity: 20,
    });

    expect(result.success).toBe(true);
  });

  test("rejects a zero quantity", () => {
    const result = stockMovementInputSchema.safeParse({
      productId,
      movementType: "adjustment",
      quantity: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Quantity must not be zero.");
    }
  });

  test("rejects an unknown movement type", () => {
    const result = stockMovementInputSchema.safeParse({
      productId,
      movementType: "restock",
      quantity: 5,
    });

    expect(result.success).toBe(false);
  });

  test("rejects a non-uuid product id", () => {
    const result = stockMovementInputSchema.safeParse({
      productId: "not-a-uuid",
      movementType: "sale",
      quantity: -1,
    });

    expect(result.success).toBe(false);
  });

  test("accepts a missing notes field", () => {
    const result = stockMovementInputSchema.safeParse({
      productId,
      movementType: "return",
      quantity: 2,
    });

    expect(result.success).toBe(true);
  });

  test("rejects notes longer than 500 characters", () => {
    const result = stockMovementInputSchema.safeParse({
      productId,
      movementType: "return",
      quantity: 2,
      notes: "x".repeat(501),
    });

    expect(result.success).toBe(false);
  });

  test("rejects a quantity above the maximum bound", () => {
    const result = stockMovementInputSchema.safeParse({
      productId,
      movementType: "adjustment",
      quantity: 2_000_000_000,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Quantity is out of range.");
    }
  });

  test("rejects a quantity below the minimum bound", () => {
    const result = stockMovementInputSchema.safeParse({
      productId,
      movementType: "adjustment",
      quantity: -2_000_000_000,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Quantity is out of range.");
    }
  });

  test("accepts a legitimate negative quantity within bounds", () => {
    const result = stockMovementInputSchema.safeParse({
      productId,
      movementType: "sale",
      quantity: -3,
    });

    expect(result.success).toBe(true);
  });

  test("accepts a legitimate positive quantity within bounds", () => {
    const result = stockMovementInputSchema.safeParse({
      productId,
      movementType: "purchase",
      quantity: 500,
    });

    expect(result.success).toBe(true);
  });
});

describe("isProductId", () => {
  test("accepts a valid uuid", () => {
    expect(isProductId(productId)).toBe(true);
  });

  test("rejects a non-uuid value", () => {
    expect(isProductId("abc")).toBe(false);
  });

  test("rejects an empty string", () => {
    expect(isProductId("")).toBe(false);
  });
});
