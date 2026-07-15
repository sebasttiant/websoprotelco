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

import { createCategory, createProduct, deleteProduct } from "@/domains/catalog/actions";

const productId = "11111111-1111-4111-8111-111111111111";
const categoryId = "22222222-2222-4222-8222-222222222222";

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

describe("catalog product actions", () => {
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
      // Only an adapter-generated local path is accepted; unsafe image URLs (remote
      // URL, data URI, traversal, legacy string) are rejected with a Spanish validation
      // error and are never silently nulled or persisted. A safe path here proves the
      // happy path still persists.
      imageUrl: "/uploads/2026-03-08-3f2504e0-4f89-41d3-9a0c-0305e82c3301.webp",
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
      "/uploads/2026-03-08-3f2504e0-4f89-41d3-9a0c-0305e82c3301.webp",
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

  test("does not delete a product when catalog permission is denied", async () => {
    mockRequirePermission.mockRejectedValue(new Error("NOT_FOUND"));

    await expect(deleteProduct(formData({ id: productId }))).rejects.toThrow("NOT_FOUND");

    expect(mockRequirePermission).toHaveBeenCalledWith("catalog:write");
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe("catalog category actions", () => {
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
