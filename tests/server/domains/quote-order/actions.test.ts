// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockRedirect, mockRequirePermission, mockGetCurrentUser, mockQuery, mockRevalidatePath } = vi.hoisted(() => ({
  mockRedirect: vi.fn((url: string) => {
    const error = new Error("NEXT_REDIRECT") as Error & { digest: string };
    error.digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw error;
  }),
  mockRequirePermission: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockQuery: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({
  requirePermission: mockRequirePermission,
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/server/db/pool", () => ({
  query: mockQuery,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { submitContactRequest, updateQuoteStatus } from "@/domains/quote-order/actions";

const staffId = "11111111-1111-4111-8111-111111111111";
const quoteId = "33333333-3333-4333-8333-333333333333";

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();

  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }

  return data;
}

afterEach(() => {
  vi.clearAllMocks();
});

const buyerId = "22222222-2222-4222-8222-222222222222";

describe("public contact request submission", () => {
  test("an unauthenticated visitor can submit a quote request stored with a NULL owner", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    mockQuery.mockResolvedValue([]);

    await expect(submitContactRequest(formData({
      name: "Jane Buyer",
      email: "jane@example.test",
      phone: "+57 300 000 0000",
      subject: "Cotización de Productos",
      message: "Necesito una cotización para fibra óptica.",
    }))).rejects.toThrow("NEXT_REDIRECT");

    // The contact form must stay open: resolving the session must never guard it.
    expect(mockRequirePermission).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith("/contacto?sent=1");

    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO quote_requests");
    expect(values).toContain("jane@example.test");
    // user_id ($6, index 5) is NULL for a guest submission.
    expect(values[5]).toBeNull();
  });

  test("an authenticated submission is bound to the session user's id", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: buyerId, email: "buyer@soprotelco.test", role: "staff" });
    mockQuery.mockResolvedValue([]);

    await expect(submitContactRequest(formData({
      name: "SOPROTELCO Buyer",
      email: "buyer@soprotelco.test",
      phone: "+57 300 000 0000",
      subject: "Cotización de Productos",
      message: "Necesito una cotización para fibra óptica.",
    }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRequirePermission).not.toHaveBeenCalled();
    const [, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(values[5]).toBe(buyerId);
  });

  test("rejects invalid contact form input without inserting a quote request", async () => {
    await expect(submitContactRequest(formData({
      name: "J",
      email: "not-an-email",
      phone: "123",
      subject: "Hi",
      message: "Too short",
    }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/contacto?error=validation");
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe("admin quote status transition", () => {
  test("updates a valid quote status transition", async () => {
    mockRequirePermission.mockResolvedValue({ id: staffId, email: "staff@soprotelco.test", role: "staff" });
    mockQuery.mockResolvedValueOnce([{ status: "received" }]).mockResolvedValueOnce([]);

    await expect(updateQuoteStatus(formData({ id: quoteId, status: "in_review" }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/admin/quotes?success=quote-updated");
    expect(mockRequirePermission).toHaveBeenCalledWith("quote:write");
    expect(mockQuery).toHaveBeenNthCalledWith(2, "UPDATE quote_requests SET status = $2 WHERE id = $1", [quoteId, "in_review"]);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/quotes");
  });

  test("rejects invalid quote status transitions without updating", async () => {
    mockRequirePermission.mockResolvedValue({ id: staffId, email: "staff@soprotelco.test", role: "staff" });
    mockQuery.mockResolvedValueOnce([{ status: "won" }]);

    await expect(updateQuoteStatus(formData({ id: quoteId, status: "lost" }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockRedirect).toHaveBeenCalledWith("/admin/quotes?error=action-failed");
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
