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

import { getDiscountPercent, getEffectivePriceCents, productAdminInputSchema } from "@/domains/catalog/schemas";

const baseAdminInput = {
  categoryId: "11111111-1111-4111-8111-111111111111",
  sku: "FUS-01",
  slug: "fusionadora",
  name: "Fusionadora",
  description: "",
  priceCents: 1_000_000,
  currency: "COP",
  imageUrl: null,
  brand: null,
  stockQuantity: 3,
  isActive: true,
};

describe("product promotions and featured flag", () => {
  test("defaults to no promotion and not featured", () => {
    const parsed = productAdminInputSchema.parse(baseAdminInput);
    expect(parsed.promoPriceCents).toBeNull();
    expect(parsed.isFeatured).toBe(false);
  });

  test("accepts a promotional price lower than the list price", () => {
    const parsed = productAdminInputSchema.parse({ ...baseAdminInput, promoPriceCents: 800_000, isFeatured: true });
    expect(parsed.promoPriceCents).toBe(800_000);
    expect(parsed.isFeatured).toBe(true);
  });

  test("treats a zero promotional price as no promotion", () => {
    expect(productAdminInputSchema.parse({ ...baseAdminInput, promoPriceCents: 0 }).promoPriceCents).toBeNull();
  });

  test("rejects a promotional price that is not lower than the list price", () => {
    expect(() => productAdminInputSchema.parse({ ...baseAdminInput, promoPriceCents: 1_000_000 })).toThrow();
    expect(() => productAdminInputSchema.parse({ ...baseAdminInput, promoPriceCents: 1_200_000 })).toThrow();
  });

  test("effective price is the promo price when present, otherwise the list price", () => {
    expect(getEffectivePriceCents({ priceCents: 1_000_000, promoPriceCents: 750_000 })).toBe(750_000);
    expect(getEffectivePriceCents({ priceCents: 1_000_000, promoPriceCents: null })).toBe(1_000_000);
  });

  test("discount percent is rounded and null without promotion", () => {
    expect(getDiscountPercent({ priceCents: 1_000_000, promoPriceCents: 750_000 })).toBe(25);
    expect(getDiscountPercent({ priceCents: 890_000, promoPriceCents: 712_000 })).toBe(20);
    expect(getDiscountPercent({ priceCents: 1_000_000, promoPriceCents: null })).toBeNull();
  });
});
