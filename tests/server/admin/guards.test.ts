// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockRequirePermission, mockQuery } = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockQuery: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/server/db/pool", () => ({
  query: mockQuery,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { deleteProduct, updateQuoteStatus } from "@/app/admin/actions";

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

describe("admin action guards", () => {
  test("does not delete a product when catalog permission is denied", async () => {
    mockRequirePermission.mockRejectedValue(new Error("NOT_FOUND"));

    await expect(deleteProduct(formData({ id: productId }))).rejects.toThrow("NOT_FOUND");

    expect(mockRequirePermission).toHaveBeenCalledWith("catalog:write");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("does not read or update quote status when quote permission is denied", async () => {
    mockRequirePermission.mockRejectedValue(new Error("NOT_FOUND"));

    await expect(updateQuoteStatus(formData({ id: quoteId, status: "in_review" }))).rejects.toThrow("NOT_FOUND");

    expect(mockRequirePermission).toHaveBeenCalledWith("quote:write");
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
