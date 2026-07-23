import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

const { mockRequirePermission } = vi.hoisted(() => ({ mockRequirePermission: vi.fn() }));

vi.mock("@/server/auth/guards", () => ({ requirePermission: mockRequirePermission }));
vi.mock("@/domains/catalog", () => ({
  getCategoryByIdForAdmin: vi.fn(async () => ({ id: "22222222-2222-4222-8222-222222222222", parentId: null, slug: "fiber", name: "Fiber", imageUrl: null, displayOrder: 1 })),
  getCategoryOptions: vi.fn(async () => [{ id: "22222222-2222-4222-8222-222222222222", name: "Fiber" }]),
  getCategoryOptionsExcluding: vi.fn(async () => []),
  getProductByIdForAdmin: vi.fn(async () => ({ id: "11111111-1111-4111-8111-111111111111", categoryId: "22222222-2222-4222-8222-222222222222", sku: "SP-1", slug: "sp-1", name: "Tool", description: "", priceCents: 100, currency: "COP", imageUrl: null, brand: null, stockQuantity: 1, isActive: true })),
  updateCategory: vi.fn(),
  updateProduct: vi.fn(),
}));

const { default: EditProductPage } = await import("@/app/admin/products/[id]/page");
const { default: EditCategoryPage } = await import("@/app/admin/categories/[id]/page");

const id = "11111111-1111-4111-8111-111111111111";

describe("catalog edit error contracts", () => {
  test("renders product edit errors accessibly", async () => {
    mockRequirePermission.mockResolvedValue({ id, role: "admin" });
    render(await EditProductPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({ error: "action-failed" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent(/no se pudo actualizar el producto/i);
  });

  test("renders category edit errors accessibly", async () => {
    mockRequirePermission.mockResolvedValue({ id, role: "admin" });
    render(await EditCategoryPage({ params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" }), searchParams: Promise.resolve({ error: "action-failed" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent(/no se pudo actualizar la categoría/i);
  });
});
