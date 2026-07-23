import { afterEach, describe, expect, test, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock("@/server/db/pool", () => ({ query: mockQuery }));

import { enqueueNotification } from "@/server/notifications/outbox";

afterEach(() => {
  vi.clearAllMocks();
});

describe("enqueueNotification", () => {
  test("persists a pending notification without requiring a delivery provider", async () => {
    mockQuery.mockResolvedValue([]);

    await enqueueNotification({
      channel: "email",
      eventType: "quote-request.created",
      payload: { quoteRequestId: "quote-1" },
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notification_outbox"),
      ["email", "quote-request.created", JSON.stringify({ quoteRequestId: "quote-1" })],
    );
  });

  test("uses a caller transaction client when one is provided", async () => {
    const transaction = { query: vi.fn().mockResolvedValue(undefined) };

    await enqueueNotification(
      {
        channel: "email",
        eventType: "quote-request.created",
        payload: { quoteRequestId: "quote-1" },
      },
      transaction,
    );

    expect(transaction.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO notification_outbox"),
      ["email", "quote-request.created", JSON.stringify({ quoteRequestId: "quote-1" })],
    );
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // A real `pg.Client`/`pg.PoolClient` reads instance state inside `query`, so a detached
  // method throws. This fake reproduces that; a bare `vi.fn()` cannot, which is why the
  // previous coverage missed the defect.
  test("preserves the transaction receiver so a real pg client can execute the insert", async () => {
    class FakeTransactionClient {
      readonly statements: string[] = [];

      async query(text: string, values?: readonly unknown[]): Promise<unknown> {
        this.statements.push(text);

        return { rows: [], values };
      }
    }

    const transaction = new FakeTransactionClient();

    await enqueueNotification(
      { channel: "email", eventType: "order.created", payload: { orderId: "order-1" } },
      transaction,
    );

    expect(transaction.statements).toHaveLength(1);
    expect(transaction.statements[0]).toContain("INSERT INTO notification_outbox");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("does not fall back to the pool when the caller transaction fails", async () => {
    const transaction = {
      query: vi.fn().mockRejectedValue(new Error("transaction aborted")),
    };

    await expect(
      enqueueNotification({ channel: "email", eventType: "order.created", payload: {} }, transaction),
    ).rejects.toThrow("transaction aborted");

    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("rejects unsupported channels before writing the outbox", async () => {
    await expect(
      enqueueNotification({
        channel: "sms",
        eventType: "quote-request.created",
        payload: { quoteRequestId: "quote-1" },
      }),
    ).rejects.toThrow("Invalid notification input");

    expect(mockQuery).not.toHaveBeenCalled();
  });
});
