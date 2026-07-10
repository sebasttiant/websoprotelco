// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockHashPassword, mockRedirect, mockRequireSession, mockQuery, mockRevalidatePath, mockVerifyPassword } = vi.hoisted(() => ({
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

import { changePassword, updateProfile } from "@/app/cuenta/actions";

const userId = "11111111-1111-4111-8111-111111111111";

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
  test("updates the authenticated user's name and email", async () => {
    mockRequireSession.mockResolvedValue({ id: userId, email: "old@soprotelco.test", role: "staff" });
    mockQuery.mockResolvedValue([]);

    await expect(updateProfile(formData({ name: "SOPROTELCO Buyer", email: "Buyer@Soprotelco.test" }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockQuery).toHaveBeenCalledWith("UPDATE users SET full_name = $2, email = $3 WHERE id = $1", [
      userId,
      "SOPROTELCO Buyer",
      "buyer@soprotelco.test",
    ]);
    expect(mockRedirect).toHaveBeenCalledWith("/cuenta?success=profile-updated");
  });

  test("returns a validation error for an invalid email", async () => {
    mockRequireSession.mockResolvedValue({ id: userId, email: "old@soprotelco.test", role: "staff" });

    const result = await updateProfile(formData({ name: "SOPROTELCO Buyer", email: "not-an-email" }));

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

    await expect(changePassword(formData({
      currentPassword: "current-password",
      newPassword: "new-password-123",
      confirmPassword: "new-password-123",
    }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockVerifyPassword).toHaveBeenCalledWith("current-password", "stored-hash");
    expect(mockHashPassword).toHaveBeenCalledWith("new-password-123");
    expect(mockQuery).toHaveBeenNthCalledWith(2, "UPDATE users SET password_hash = $2 WHERE id = $1", [userId, "new-hash"]);
    expect(mockRedirect).toHaveBeenCalledWith("/cuenta?success=password-updated");
  });

  test("rejects an incorrect current password without updating", async () => {
    mockRequireSession.mockResolvedValue({ id: userId, email: "buyer@soprotelco.test", role: "staff" });
    mockQuery.mockResolvedValueOnce([{ password_hash: "stored-hash" }]);
    mockVerifyPassword.mockResolvedValue(false);

    const result = await changePassword(formData({
      currentPassword: "wrong-password",
      newPassword: "new-password-123",
      confirmPassword: "new-password-123",
    }));

    expect(result).toEqual({ success: false, message: "Current password is incorrect." });
    expect(mockHashPassword).not.toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  test("rejects mismatched new passwords", async () => {
    mockRequireSession.mockResolvedValue({ id: userId, email: "buyer@soprotelco.test", role: "staff" });

    const result = await changePassword(formData({
      currentPassword: "current-password",
      newPassword: "new-password-123",
      confirmPassword: "different-password-123",
    }));

    expect(result).toEqual({ success: false, message: "Passwords do not match." });
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
