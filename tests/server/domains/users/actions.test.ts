// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockHashPassword, mockRedirect, mockRequireSession, mockQuery, mockRevalidatePath, mockVerifyPassword } =
  vi.hoisted(() => ({
    mockHashPassword: vi.fn(),
    mockRedirect: vi.fn((url: string) => {
      const error = new Error("NEXT_REDIRECT") as Error & { digest: string };
      error.digest = `NEXT_REDIRECT;replace;${url};307;`;
      throw error;
    }),
    mockRequireSession: vi.fn(),
    mockQuery: vi.fn(),
    mockRevalidatePath: vi.fn(),
    mockVerifyPassword: vi.fn(),
  }));

vi.mock("@/server/auth/guards", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/server/auth/password", () => ({
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword,
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

import { changePassword, updateProfile } from "@/domains/users";

const userId = "11111111-1111-4111-8111-111111111111";
const foreignId = "99999999-9999-4999-8999-999999999999";

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

describe("updateProfile", () => {
  test("updates the authenticated user's name only and never touches the email column", async () => {
    mockRequireSession.mockResolvedValue({ id: userId, email: "old@soprotelco.test", role: "staff" });
    mockQuery.mockResolvedValue([]);

    await expect(updateProfile(formData({ name: "SOPROTELCO Buyer" }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockQuery).toHaveBeenCalledWith("UPDATE users SET full_name = $2 WHERE id = $1", [
      userId,
      "SOPROTELCO Buyer",
    ]);
    const [sql] = mockQuery.mock.calls[0] as [string];
    expect(sql).not.toContain("email");
    expect(mockRedirect).toHaveBeenCalledWith("/cuenta?success=profile-updated");
  });

  test("ignores a smuggled email field: a user cannot repoint their account at another address", async () => {
    mockRequireSession.mockResolvedValue({ id: userId, email: "old@soprotelco.test", role: "staff" });
    mockQuery.mockResolvedValue([]);

    await expect(
      updateProfile(formData({ name: "SOPROTELCO Buyer", email: "victim@soprotelco.test" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    // The email column is never written and the victim's address never reaches the query.
    expect(mockQuery).toHaveBeenCalledWith("UPDATE users SET full_name = $2 WHERE id = $1", [
      userId,
      "SOPROTELCO Buyer",
    ]);
    const [, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(values).not.toContain("victim@soprotelco.test");
  });

  test("ignores an attacker-supplied id and scopes the update to the session user (IDOR guard)", async () => {
    mockRequireSession.mockResolvedValue({ id: userId, email: "old@soprotelco.test", role: "staff" });
    mockQuery.mockResolvedValue([]);

    await expect(
      updateProfile(formData({ id: foreignId, name: "SOPROTELCO Buyer" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    const [, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(values[0]).toBe(userId);
    expect(values).not.toContain(foreignId);
  });

  test("returns a validation error for an invalid name", async () => {
    mockRequireSession.mockResolvedValue({ id: userId, email: "old@soprotelco.test", role: "staff" });

    const result = await updateProfile(formData({ name: "J" }));

    expect(result.success).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe("changePassword", () => {
  test("verifies the current password and stores a new hash", async () => {
    mockRequireSession.mockResolvedValue({ id: userId, email: "buyer@soprotelco.test", role: "staff" });
    mockQuery.mockResolvedValueOnce([{ password_hash: "stored-hash" }]).mockResolvedValueOnce([]);
    mockVerifyPassword.mockResolvedValue(true);
    mockHashPassword.mockResolvedValue("new-hash");

    await expect(
      changePassword(
        formData({
          currentPassword: "current-password",
          newPassword: "new-password-123",
          confirmPassword: "new-password-123",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockVerifyPassword).toHaveBeenCalledWith("current-password", "stored-hash");
    expect(mockHashPassword).toHaveBeenCalledWith("new-password-123");
    expect(mockQuery).toHaveBeenNthCalledWith(2, "UPDATE users SET password_hash = $2 WHERE id = $1", [
      userId,
      "new-hash",
    ]);
    expect(mockRedirect).toHaveBeenCalledWith("/cuenta?success=password-updated");
  });

  test("rejects an incorrect current password and writes no new hash", async () => {
    mockRequireSession.mockResolvedValue({ id: userId, email: "buyer@soprotelco.test", role: "staff" });
    mockQuery.mockResolvedValueOnce([{ password_hash: "stored-hash" }]);
    mockVerifyPassword.mockResolvedValue(false);

    const result = await changePassword(
      formData({
        currentPassword: "wrong-password",
        newPassword: "new-password-123",
        confirmPassword: "new-password-123",
      }),
    );

    expect(result).toEqual({ success: false, message: "Current password is incorrect." });
    expect(mockHashPassword).not.toHaveBeenCalled();
    // Only the credential read happened; no UPDATE was issued.
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).not.toHaveBeenCalledWith(
      "UPDATE users SET password_hash = $2 WHERE id = $1",
      expect.anything(),
    );
  });

  test("scopes the credential lookup to the session user id (IDOR guard)", async () => {
    mockRequireSession.mockResolvedValue({ id: userId, email: "buyer@soprotelco.test", role: "staff" });
    mockQuery.mockResolvedValueOnce([{ password_hash: "stored-hash" }]);
    mockVerifyPassword.mockResolvedValue(false);

    await changePassword(
      formData({
        id: foreignId,
        currentPassword: "wrong-password",
        newPassword: "new-password-123",
        confirmPassword: "new-password-123",
      }),
    );

    const [, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(values).toEqual([userId]);
  });

  test("rejects mismatched new passwords", async () => {
    mockRequireSession.mockResolvedValue({ id: userId, email: "buyer@soprotelco.test", role: "staff" });

    const result = await changePassword(
      formData({
        currentPassword: "current-password",
        newPassword: "new-password-123",
        confirmPassword: "different-password-123",
      }),
    );

    expect(result).toEqual({ success: false, message: "Passwords do not match." });
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
