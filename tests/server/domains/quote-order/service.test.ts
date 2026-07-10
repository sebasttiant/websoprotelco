// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock("@/server/db/pool", () => ({
  query: mockQuery,
}));

import { getQuotes, submitQuoteRequest, updateQuoteStatus } from "@/domains/quote-order/service";

const quoteId = "33333333-3333-4333-8333-333333333333";

afterEach(() => {
  vi.clearAllMocks();
});

describe("submitQuoteRequest", () => {
  test("prefixes the stored message with the subject and generates a reference", async () => {
    mockQuery.mockResolvedValue([]);

    await submitQuoteRequest({
      name: "Jane Buyer",
      email: "jane@example.test",
      phone: "+57 300 000 0000",
      subject: "Cotización de Productos",
      message: "Necesito una cotización para fibra óptica.",
    });

    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO quote_requests");
    expect(values[0]).toMatch(/^WEB-/);
    expect(values[4]).toBe("[Cotización de Productos] Necesito una cotización para fibra óptica.");
  });
});

describe("getQuotes", () => {
  test("maps item_count into a number and display_order-style fields to camelCase", async () => {
    mockQuery.mockResolvedValue([{
      id: quoteId,
      reference: "WEB-1",
      status: "received",
      contact_name: "Jane Buyer",
      contact_email: "jane@example.test",
      contact_phone: null,
      company_name: null,
      created_at: "2026-01-01T00:00:00.000Z",
      item_count: "3",
    }]);

    const [quote] = await getQuotes();

    expect(quote).toMatchObject({
      contactName: "Jane Buyer",
      contactEmail: "jane@example.test",
      itemCount: 3,
    });
  });
});

describe("updateQuoteStatus", () => {
  test("returns not-found when the quote does not exist", async () => {
    mockQuery.mockResolvedValueOnce([]);

    const outcome = await updateQuoteStatus({ id: quoteId, status: "in_review" });

    expect(outcome).toBe("not-found");
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  test("returns unchanged without writing when the status is already set", async () => {
    mockQuery.mockResolvedValueOnce([{ status: "in_review" }]);

    const outcome = await updateQuoteStatus({ id: quoteId, status: "in_review" });

    expect(outcome).toBe("unchanged");
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  test("returns invalid-transition for a disallowed jump and does not write", async () => {
    mockQuery.mockResolvedValueOnce([{ status: "received" }]);

    const outcome = await updateQuoteStatus({ id: quoteId, status: "won" });

    expect(outcome).toBe("invalid-transition");
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  test("returns invalid-transition when the current status is terminal", async () => {
    mockQuery.mockResolvedValueOnce([{ status: "cancelled" }]);

    const outcome = await updateQuoteStatus({ id: quoteId, status: "in_review" });

    expect(outcome).toBe("invalid-transition");
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  test("updates and returns updated for an allowed transition", async () => {
    mockQuery.mockResolvedValueOnce([{ status: "received" }]).mockResolvedValueOnce([]);

    const outcome = await updateQuoteStatus({ id: quoteId, status: "in_review" });

    expect(outcome).toBe("updated");
    expect(mockQuery).toHaveBeenNthCalledWith(2, "UPDATE quote_requests SET status = $2 WHERE id = $1", [quoteId, "in_review"]);
  });
});
