import { describe, expect, test } from "vitest";

import type { CartItem } from "@/components/cart/cart-storage";
import { buildOrderInput, canSubmitContact, EMPTY_FORM } from "@/components/cart/cart-drawer/contact";
import { formatCurrency } from "@/components/cart/cart-drawer/format";
import { buildWhatsappHref, toWaNumber } from "@/components/cart/cart-drawer/whatsapp";

const item = (id: string, quantity: number): CartItem => ({
  id,
  slug: "producto",
  name: "Producto",
  priceCents: 100000,
  currency: "COP",
  quantity,
});

describe("formatCurrency", () => {
  test("formats cents as whole Colombian pesos", () => {
    expect(formatCurrency(3250000).replace(/\s/g, " ")).toBe("$ 32.500");
    expect(formatCurrency(0).replace(/\s/g, " ")).toBe("$ 0");
  });
});

describe("toWaNumber", () => {
  test("keeps digits only", () => {
    expect(toWaNumber("+57 300-123 4567")).toBe("573001234567");
    expect(toWaNumber("  ")).toBe("");
  });
});

describe("buildWhatsappHref", () => {
  test("returns an empty href when the number has no digits", () => {
    expect(buildWhatsappHref("n/a", "PED-1", 100)).toBe("");
  });

  test("encodes the confirmation message for wa.me", () => {
    const href = buildWhatsappHref("+57 300 123 4567", "PED-1", 250000);
    const url = new URL(href);

    expect(url.origin + url.pathname).toBe("https://wa.me/573001234567");
    expect(url.searchParams.get("text")).toBe(
      `Hola, acabo de confirmar el pedido PED-1 por ${formatCurrency(250000)}. Quedo atento para coordinar pago y entrega.`,
    );
  });
});

describe("canSubmitContact", () => {
  const valid = { name: "Ju", email: "a@b", phone: "1234567", notes: "" };

  test("accepts the minimum contact data", () => {
    expect(canSubmitContact(valid)).toBe(true);
  });

  test.each([
    ["short name", { name: " J " }],
    ["email without @", { email: "ab" }],
    ["short phone", { phone: " 123456 " }],
  ])("rejects %s", (_label, override) => {
    expect(canSubmitContact({ ...valid, ...override })).toBe(false);
  });

  test("starts blocked from the empty form", () => {
    expect(canSubmitContact(EMPTY_FORM)).toBe(false);
  });
});

describe("buildOrderInput", () => {
  test("sends contact fields and only product ids with quantities", () => {
    const form = { name: "Juan", email: "j@e.co", phone: "3001234567", notes: "Calle 1" };

    expect(buildOrderInput(form, [item("a", 2), item("b", 1)])).toEqual({
      ...form,
      items: [
        { productId: "a", quantity: 2 },
        { productId: "b", quantity: 1 },
      ],
    });
  });
});
