// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockRedirect, mockRequirePermission, mockQuery, mockRevalidatePath } = vi.hoisted(() => ({
  mockRedirect: vi.fn((url: string) => {
    const error = new Error("NEXT_REDIRECT") as Error & { digest: string };
    error.digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw error;
  }),
  mockRequirePermission: vi.fn(),
  mockQuery: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({
  requirePermission: mockRequirePermission,
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

import { updateQuoteStatus } from "@/app/admin/actions";

const productId = "11111111-1111-4111-8111-111111111111";
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

describe("admin quote actions", () => {
  test("updates a valid quote status transition", async () => {
    mockRequirePermission.mockResolvedValue({ id: productId, email: "staff@soprotelco.test", role: "staff" });
    mockQuery.mockResolvedValueOnce([{ status: "received" }]).mockResolvedValueOnce([]);

    await expect(updateQuoteStatus(formData({ id: quoteId, status: "in_review" }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/admin/quotes?success=quote-updated");
    expect(mockRequirePermission).toHaveBeenCalledWith("quote:write");
    expect(mockQuery).toHaveBeenNthCalledWith(2, "UPDATE quote_requests SET status = $2 WHERE id = $1", [quoteId, "in_review"]);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/quotes");
  });

  test("rejects invalid quote status transitions without updating", async () => {
    mockRequirePermission.mockResolvedValue({ id: productId, email: "staff@soprotelco.test", role: "staff" });
    mockQuery.mockResolvedValueOnce([{ status: "won" }]);

    await expect(updateQuoteStatus(formData({ id: quoteId, status: "lost" }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockRedirect).toHaveBeenCalledWith("/admin/quotes?error=action-failed");
  });
});
