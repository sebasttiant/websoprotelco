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
  withTransaction: async (handler: (client: { query: typeof mockQuery }) => Promise<unknown>) =>
    handler({ query: mockQuery }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { recordStockMovement } from "@/domains/inventory/actions";

const adminId = "11111111-1111-4111-8111-111111111111";
const productId = "33333333-3333-4333-8333-333333333333";

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

describe("recordStockMovement", () => {
  test("requires the inventory:write permission before writing", async () => {
    mockRequirePermission.mockResolvedValue({ id: adminId, email: "admin@soprotelco.test", role: "admin" });
    mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ stock_quantity: 7 }]);

    await expect(
      recordStockMovement(
        formData({ productId, movementType: "sale", quantity: "-3", notes: "Sold at the counter" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRequirePermission).toHaveBeenCalledWith("inventory:write");
    const [insertSql, insertValues] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(insertSql).toContain("INSERT INTO stock_movements");
    expect(insertValues).toEqual([productId, "sale", -3, "Sold at the counter", adminId]);
    const [updateSql] = mockQuery.mock.calls[1] as [string, unknown[]];
    expect(updateSql).toContain("UPDATE products");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/inventory");
    expect(mockRedirect).toHaveBeenCalledWith("/admin/inventory?success=movement-recorded");
  });

  test("checks the permission before parsing input", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await expect(
      recordStockMovement(formData({ productId: "not-a-uuid", movementType: "sale", quantity: "0" })),
    ).rejects.toThrow("forbidden");

    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("returns a validation error for a zero quantity and never writes", async () => {
    mockRequirePermission.mockResolvedValue({ id: adminId, email: "admin@soprotelco.test", role: "admin" });

    const result = await recordStockMovement(formData({ productId, movementType: "sale", quantity: "0" }));

    expect(result.success).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
