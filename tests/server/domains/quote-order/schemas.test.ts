import { describe, expect, test } from "vitest";

import { contactRequestInputSchema, isQuoteStatus } from "@/domains/quote-order/schemas";

describe("contactRequestInputSchema", () => {
  test("accepts a well-formed contact request", () => {
    const result = contactRequestInputSchema.safeParse({
      name: "Jane Buyer",
      email: "jane@example.test",
      phone: "+57 300 000 0000",
      subject: "Cotización de Productos",
      message: "Necesito una cotización para fibra óptica.",
    });

    expect(result.success).toBe(true);
  });

  test("rejects invalid contact form input", () => {
    const result = contactRequestInputSchema.safeParse({
      name: "J",
      email: "not-an-email",
      phone: "123",
      subject: "Hi",
      message: "Too short",
    });

    expect(result.success).toBe(false);
  });
});

describe("isQuoteStatus", () => {
  test("accepts a known status", () => {
    expect(isQuoteStatus("in_review")).toBe(true);
  });

  test("rejects an unknown status", () => {
    expect(isQuoteStatus("archived")).toBe(false);
  });
});
