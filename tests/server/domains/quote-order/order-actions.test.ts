// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockRequirePermission, mockGetCurrentUser, mockQuery, mockClientQuery, mockWithTransaction, mockRevalidatePath } =
  vi.hoisted(() => {
    const mockClientQuery = vi.fn();

    return {
      mockRequirePermission: vi.fn(),
      mockGetCurrentUser: vi.fn(),
      mockQuery: vi.fn(),
      mockClientQuery,
      mockWithTransaction: vi.fn(async (handler: (client: { query: unknown }) => Promise<unknown>) =>
        handler({ query: mockClientQuery }),
      ),
      mockRevalidatePath: vi.fn(),
    };
  });

vi.mock("@/server/auth/guards", () => ({
  requirePermission: mockRequirePermission,
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/server/db/pool", () => ({
  query: mockQuery,
  withTransaction: mockWithTransaction,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { createAdminOrder, submitCartOrder } from "@/domains/quote-order/actions";

const productId = "11111111-1111-4111-8111-111111111111";
const orderId = "99999999-9999-4999-8999-999999999999";
const staffId = "55555555-5555-4555-8555-555555555555";
const customerId = "66666666-6666-4666-8666-666666666666";

const validInput = {
  name: "Jane Buyer",
  email: "jane@example.test",
  phone: "+57 300 000 0000",
  notes: "",
  items: [{ productId, quantity: 2 }],
} as const;

function stubHappyPath(): void {
  mockClientQuery.mockResolvedValueOnce([{ id: productId, name: "Switch PoE+", price_cents: "69900000" }]);
  mockClientQuery.mockResolvedValueOnce([{ id: orderId }]);
  mockClientQuery.mockResolvedValue([]);
}

/** The user_id bound on the inserted order, read off the quote_requests INSERT. */
function insertedUserId(): unknown {
  const orderInsert = mockClientQuery.mock.calls[1] as [string, unknown[]];
  return orderInsert[1][5];
}

afterEach(() => {
  // clearAllMocks resets recorded calls but NOT the mockResolvedValueOnce queues. A value
  // queued for a call that never happens survives into the next test and shifts every
  // subsequent assertion by one, so the queues are drained explicitly.
  mockRequirePermission.mockReset();
  mockGetCurrentUser.mockReset();
  mockClientQuery.mockReset();
  vi.clearAllMocks();
});

describe("createAdminOrder", () => {
  test("requires the quote:write permission", async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error("forbidden"));

    await expect(createAdminOrder(validInput)).rejects.toThrow("forbidden");
    expect(mockRequirePermission).toHaveBeenCalledWith("quote:write");
    expect(mockWithTransaction).not.toHaveBeenCalled();
  });

  test("leaves ownership NULL instead of filing the order under the staff member", async () => {
    // The signed-in user here is the employee taking a phone order, not the customer. Binding
    // the order to them would surface a stranger's purchase in that employee's own account.
    mockRequirePermission.mockResolvedValueOnce({ id: staffId, email: "staff@soprotelco.test", role: "staff" });
    stubHappyPath();

    const state = await createAdminOrder(validInput);

    expect(state.success).toBe(true);
    expect(insertedUserId()).toBeNull();
    // Never even asks who is signed in: there is no session to bind, by design.
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  test("returns the server-computed total, not one supplied by the caller", async () => {
    mockRequirePermission.mockResolvedValueOnce({ id: staffId, email: "staff@soprotelco.test", role: "staff" });
    stubHappyPath();

    // A caller-supplied total is not part of the schema, so this extra key is simply dropped.
    const state = await createAdminOrder({ ...validInput, totalCents: 1 });

    expect(state).toMatchObject({ success: true, totalCents: 139800000 });
  });

  test("rejects an order with no items", async () => {
    mockRequirePermission.mockResolvedValueOnce({ id: staffId, email: "staff@soprotelco.test", role: "staff" });

    const state = await createAdminOrder({ ...validInput, items: [] });

    expect(state.success).toBe(false);
    expect(mockWithTransaction).not.toHaveBeenCalled();
  });
});

describe("submitCartOrder", () => {
  test("is reachable by guests and leaves ownership NULL", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    stubHappyPath();

    const state = await submitCartOrder(validInput);

    expect(state.success).toBe(true);
    expect(mockRequirePermission).not.toHaveBeenCalled();
    expect(insertedUserId()).toBeNull();
  });

  test("binds the order to the signed-in customer's own id", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: customerId, email: "jane@example.test", role: "customer" });
    stubHappyPath();

    await submitCartOrder(validInput);

    expect(insertedUserId()).toBe(customerId);
  });

  test("reports a validation failure without writing anything", async () => {
    const state = await submitCartOrder({ ...validInput, email: "not-an-email" });

    expect(state.success).toBe(false);
    expect(mockWithTransaction).not.toHaveBeenCalled();
  });
});
