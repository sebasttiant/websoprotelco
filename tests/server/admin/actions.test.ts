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

import { createCategory, createProduct, updateQuoteStatus } from "@/app/admin/actions";

const productId = "11111111-1111-4111-8111-111111111111";
const categoryId = "22222222-2222-4222-8222-222222222222";
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

describe("admin product actions", () => {
  test("creates a product after catalog write permission passes", async () => {
    mockRequirePermission.mockResolvedValue({ id: productId, email: "admin@soprotelco.test", role: "admin" });
    mockQuery.mockResolvedValue([]);

    await expect(createProduct(formData({
      categoryId,
      sku: "SP-100",
      slug: "sp-100",
      name: "Fiber tool",
      description: "Professional tool",
      priceCents: "120000",
      currency: "cop",
      imageUrl: "https://example.test/tool.png",
      brand: "SOPROTELCO",
      stockQuantity: "4",
      isActive: "on",
    }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/admin/products?success=product-created");
    expect(mockRequirePermission).toHaveBeenCalledWith("catalog:write");
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO products"), [
      categoryId,
      "SP-100",
      "sp-100",
      "Fiber tool",
      "Professional tool",
      120000,
      "COP",
      "https://example.test/tool.png",
      "SOPROTELCO",
      4,
      true,
    ]);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/products");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/productos");
  });

  test("returns a validation error without mutating when required product data is missing", async () => {
    mockRequirePermission.mockResolvedValue({ id: productId, email: "admin@soprotelco.test", role: "admin" });

    await expect(createProduct(formData({ categoryId }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith("/admin/products/new?error=action-failed");
  });
});

describe("admin category actions", () => {
  test("creates a category and mirrors display order to the legacy position column", async () => {
    mockRequirePermission.mockResolvedValue({ id: productId, email: "admin@soprotelco.test", role: "admin" });
    mockQuery.mockResolvedValue([]);

    await expect(createCategory(formData({
      slug: "fiber",
      name: "Fiber",
      parentId: "",
      imageUrl: "",
      displayOrder: "2",
    }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/admin/categories?success=category-created");
    expect(mockRequirePermission).toHaveBeenCalledWith("catalog:write");
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO categories"), [null, "fiber", "Fiber", null, 2]);
  });
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
