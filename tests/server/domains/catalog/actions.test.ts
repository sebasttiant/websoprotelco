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

import { createCategory, createProduct, deleteProduct, updateCategory, updateProduct } from "@/domains/catalog/actions";

const productId = "11111111-1111-4111-8111-111111111111";
const categoryId = "22222222-2222-4222-8222-222222222222";
const productRow = { id: productId, category_id: categoryId, sku: "SP-0", slug: "sp-0", name: "Tool", description: "", price_cents: "1", currency: "COP", image_url: "legacy/products/tool.jpg", brand: "SOPROTELCO", stock_quantity: 1, is_active: true };
const categoryRow = { id: categoryId, parent_id: null, slug: "fiber", name: "Fiber", image_url: "legacy/categories/fiber.png", display_order: 1 };

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

  test("retains a product image when the image field is omitted", async () => {
    mockRequirePermission.mockResolvedValue({ id: productId, email: "admin@soprotelco.test", role: "admin" });
    mockQuery.mockResolvedValueOnce([productRow]).mockResolvedValueOnce([]);

    await expect(updateProduct(formData({
      id: productId,
      categoryId,
      sku: "SP-101",
      slug: "sp-101",
      name: "Updated tool",
      description: "Still valid",
      priceCents: "130000",
      currency: "COP",
      brand: "SOPROTELCO",
      stockQuantity: "5",
    }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/admin/products?success=product-updated");
    expect(mockQuery.mock.calls[1]).toEqual([expect.stringContaining("image_url = CASE WHEN $9 THEN $10 ELSE image_url END"), expect.arrayContaining([false, undefined])]);
  });

  test("removes a product image when the legacy value is explicitly blanked", async () => {
    mockRequirePermission.mockResolvedValue({ id: productId, email: "admin@soprotelco.test", role: "admin" });
    mockQuery.mockResolvedValueOnce([productRow]).mockResolvedValueOnce([]);

    await expect(updateProduct(formData({
      id: productId,
      categoryId,
      sku: "SP-103",
      slug: "sp-103",
      name: "Blank image",
      priceCents: "130000",
      currency: "COP",
      imageUrl: "",
      brand: "SOPROTELCO",
      stockQuantity: "5",
    }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/admin/products?success=product-updated");
    expect(mockQuery.mock.calls[1]).toEqual([expect.stringContaining("image_url = CASE WHEN $9 THEN $10 ELSE image_url END"), expect.arrayContaining([true, null])]);
  });

  test("rejects a forged matching unsafe product image value when the database value differs", async () => {
    mockRequirePermission.mockResolvedValue({ id: productId, email: "admin@soprotelco.test", role: "admin" });
    mockQuery.mockResolvedValueOnce([{ ...productRow, image_url: null }]);

    await expect(updateProduct(formData({
      id: productId,
      categoryId,
      sku: "SP-102",
      slug: "sp-102",
      name: "Unsafe image",
      priceCents: "130000",
      currency: "COP",
      imageUrl: "javascript:alert(1)",
      imageUrlOriginal: "javascript:alert(1)",
      stockQuantity: "5",
    }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockQuery).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith(`/admin/products/${productId}?error=action-failed`);
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

  test("retains a category image when the image field is omitted", async () => {
    mockRequirePermission.mockResolvedValue({ id: productId, email: "admin@soprotelco.test", role: "admin" });
    mockQuery.mockResolvedValueOnce([categoryRow]).mockResolvedValueOnce([]);

    await expect(updateCategory(formData({
      id: categoryId,
      slug: "fiber-updated",
      name: "Fiber updated",
      parentId: "",
      displayOrder: "3",
    }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/admin/categories?success=category-updated");
    expect(mockQuery.mock.calls[1]).toEqual([expect.stringContaining("image_url = CASE WHEN $5 THEN $6 ELSE image_url END"), [categoryId, null, "fiber-updated", "Fiber updated", false, undefined, 3]]);
  });

  test("removes a category image when the legacy value is explicitly blanked", async () => {
    mockRequirePermission.mockResolvedValue({ id: productId, email: "admin@soprotelco.test", role: "admin" });
    mockQuery.mockResolvedValueOnce([categoryRow]).mockResolvedValueOnce([]);

    await expect(updateCategory(formData({
      id: categoryId,
      slug: "fiber-blank",
      name: "Fiber blank",
      parentId: "",
      imageUrl: "",
      displayOrder: "4",
    }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/admin/categories?success=category-updated");
    expect(mockQuery.mock.calls[1]).toEqual([expect.stringContaining("image_url = CASE WHEN $5 THEN $6 ELSE image_url END"), [categoryId, null, "fiber-blank", "Fiber blank", true, null, 4]]);
  });

  test("rejects a forged matching unsafe category image value when the database value differs", async () => {
    mockRequirePermission.mockResolvedValue({ id: productId, email: "admin@soprotelco.test", role: "admin" });
    mockQuery.mockResolvedValueOnce([{ ...categoryRow, image_url: null }]);

    await expect(updateCategory(formData({
      id: categoryId,
      slug: "fiber-unsafe",
      name: "Fiber unsafe",
      parentId: "",
      imageUrl: "javascript:alert(1)",
      imageUrlOriginal: "javascript:alert(1)",
      displayOrder: "4",
    }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockQuery).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith(`/admin/categories/${categoryId}?error=action-failed`);
  });
});
