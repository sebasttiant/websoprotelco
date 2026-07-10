// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockQuery, mockVerifyPassword, mockHashPassword } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockVerifyPassword: vi.fn(),
  mockHashPassword: vi.fn(),
}));

vi.mock("@/server/db/pool", () => ({
  query: mockQuery,
}));

vi.mock("@/server/auth/password", () => ({
  verifyPassword: mockVerifyPassword,
  hashPassword: mockHashPassword,
}));

import { changePassword, getAccountOverview, getProfileDetails, getUsersForAdmin } from "@/domains/users/service";

const sessionId = "11111111-1111-4111-8111-111111111111";
const foreignId = "99999999-9999-4999-8999-999999999999";

afterEach(() => {
  vi.clearAllMocks();
});

describe("getUsersForAdmin", () => {
  test("orders users and never selects the credential column", async () => {
    mockQuery.mockResolvedValue([]);

    await getUsersForAdmin();

    const [sql] = mockQuery.mock.calls[0] as [string];
    expect(sql).toContain("ORDER BY created_at DESC, email ASC");
    expect(sql).not.toContain("password_hash");
  });

  test("maps a row into an AdminUserSummary without leaking the credential", async () => {
    mockQuery.mockResolvedValue([
      {
        id: sessionId,
        email: "admin@soprotelco.test",
        role: "admin",
        is_active: true,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const [user] = await getUsersForAdmin();

    expect(user).toEqual({
      id: sessionId,
      email: "admin@soprotelco.test",
      role: "admin",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(user).not.toHaveProperty("password_hash");
  });
});

describe("getAccountOverview", () => {
  test("scopes the read to the id it is given, even a foreign one (IDOR guard)", async () => {
    mockQuery.mockResolvedValue([]);

    await getAccountOverview(foreignId);

    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("WHERE id = $1");
    expect(sql).not.toContain("password_hash");
    expect(values).toEqual([foreignId]);
  });

  test("returns null when no row belongs to the id", async () => {
    mockQuery.mockResolvedValue([]);

    expect(await getAccountOverview(sessionId)).toBeNull();
  });
});

describe("getProfileDetails", () => {
  test("scopes the read to the session user id and omits the credential", async () => {
    mockQuery.mockResolvedValue([]);

    await getProfileDetails(sessionId);

    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("WHERE id = $1");
    expect(sql).not.toContain("password_hash");
    expect(values).toEqual([sessionId]);
  });
});

describe("changePassword", () => {
  test("returns invalid-current-password and writes no hash when verification fails", async () => {
    mockQuery.mockResolvedValueOnce([{ password_hash: "stored-hash" }]);
    mockVerifyPassword.mockResolvedValue(false);

    const outcome = await changePassword(sessionId, {
      currentPassword: "wrong",
      newPassword: "new-password-123",
      confirmPassword: "new-password-123",
    });

    expect(outcome).toBe("invalid-current-password");
    expect(mockHashPassword).not.toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  test("re-verifies against the session user's stored hash before updating", async () => {
    mockQuery.mockResolvedValueOnce([{ password_hash: "stored-hash" }]).mockResolvedValueOnce([]);
    mockVerifyPassword.mockResolvedValue(true);
    mockHashPassword.mockResolvedValue("new-hash");

    const outcome = await changePassword(sessionId, {
      currentPassword: "current",
      newPassword: "new-password-123",
      confirmPassword: "new-password-123",
    });

    expect(outcome).toBe("updated");
    expect(mockVerifyPassword).toHaveBeenCalledWith("current", "stored-hash");
    const [lookupSql, lookupValues] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(lookupSql).toContain("WHERE id = $1");
    expect(lookupValues).toEqual([sessionId]);
  });
});
