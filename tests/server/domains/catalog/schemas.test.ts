import { describe, expect, test } from "vitest";

import { productAdminPageSchema } from "@/domains/catalog/schemas";

describe("productAdminPageSchema", () => {
  test("accepts a well-formed positive page number", () => {
    expect(productAdminPageSchema.parse(3)).toBe(3);
  });

  test("coerces a numeric string coming from a URL search param", () => {
    expect(productAdminPageSchema.parse("7")).toBe(7);
  });

  test("falls back to page 1 for a negative page", () => {
    expect(productAdminPageSchema.parse(-5)).toBe(1);
  });

  test("falls back to page 1 for a zero page", () => {
    expect(productAdminPageSchema.parse(0)).toBe(1);
  });

  test("falls back to page 1 for a non-numeric value", () => {
    expect(productAdminPageSchema.parse("not-a-number")).toBe(1);
  });

  test("falls back to page 1 for an absurdly large page instead of trusting it", () => {
    expect(productAdminPageSchema.parse(999_999_999)).toBe(1);
  });

  test("falls back to page 1 when the value is missing", () => {
    expect(productAdminPageSchema.parse(undefined)).toBe(1);
  });
});
