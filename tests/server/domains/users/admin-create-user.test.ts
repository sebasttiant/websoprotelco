// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockRequirePermission, mockHashPassword, mockQuery, mockRevalidatePath } = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockHashPassword: vi.fn(),
  mockQuery: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({
  requirePermission: mockRequirePermission,
  requireSession: vi.fn(),
}));

vi.mock("@/server/auth/password", () => ({
  hashPassword: mockHashPassword,
  verifyPassword: vi.fn(),
}));

vi.mock("@/server/db/pool", () => ({
  query: mockQuery,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { createUser } from "@/domains/users/actions";

const validInput = {
  fullName: "Ana Admin",
  email: "Ana@Empresa.com",
  password: "supersecret1",
  role: "staff",
} as const;

afterEach(() => {
  mockRequirePermission.mockReset();
  mockHashPassword.mockReset();
  mockQuery.mockReset();
  mockRevalidatePath.mockReset();
});

function insertCall(): [string, unknown[]] {
  return mockQuery.mock.calls[0] as [string, unknown[]];
}

describe("createUser (admin action)", () => {
  test("requires admin:access before parsing or touching the database", async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error("forbidden"));

    await expect(createUser(validInput)).rejects.toThrow("forbidden");
    expect(mockRequirePermission).toHaveBeenCalledWith("admin:access");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("hashes the password and inserts with the chosen role", async () => {
    mockRequirePermission.mockResolvedValueOnce(undefined);
    mockHashPassword.mockResolvedValueOnce("HASHED");
    mockQuery.mockResolvedValueOnce([{ id: "new-id" }]);

    const state = await createUser(validInput);

    expect(state).toEqual({ success: true, message: "Usuario creado." });
    expect(mockHashPassword).toHaveBeenCalledWith("supersecret1");

    const [sql, values] = insertCall();
    expect(sql).toContain("INSERT INTO users");
    expect(sql).toContain("ON CONFLICT");
    // email lowercased by the schema, hash from hashPassword, role passed through.
    expect(values).toEqual(["ana@empresa.com", "Ana Admin", "HASHED", "staff"]);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  test("can create any assignable role, including admin", async () => {
    mockRequirePermission.mockResolvedValueOnce(undefined);
    mockHashPassword.mockResolvedValueOnce("HASHED");
    mockQuery.mockResolvedValueOnce([{ id: "new-id" }]);

    await createUser({ ...validInput, role: "admin" });

    const [, values] = insertCall();
    expect(values[3]).toBe("admin");
  });

  test("reports a taken email instead of throwing when the insert conflicts", async () => {
    mockRequirePermission.mockResolvedValueOnce(undefined);
    mockHashPassword.mockResolvedValueOnce("HASHED");
    // ON CONFLICT DO NOTHING returns no row for a duplicate email.
    mockQuery.mockResolvedValueOnce([]);

    const state = await createUser(validInput);

    expect(state).toEqual({ success: false, message: "Ese correo ya está registrado." });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  test("rejects a short password without hashing or querying", async () => {
    mockRequirePermission.mockResolvedValueOnce(undefined);

    const state = await createUser({ ...validInput, password: "short" });

    expect(state.success).toBe(false);
    expect(mockHashPassword).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test.each([8, 11])("rejects a %i-character password without hashing or querying", async (length) => {
    mockRequirePermission.mockResolvedValueOnce(undefined);

    const state = await createUser({ ...validInput, password: "x".repeat(length) });

    expect(state).toEqual({ success: false, message: expect.stringContaining("al menos 12") });
    expect(mockHashPassword).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  test("accepts a password of exactly 12 characters", async () => {
    mockRequirePermission.mockResolvedValueOnce(undefined);
    mockHashPassword.mockResolvedValueOnce("hashed");
    mockQuery.mockResolvedValueOnce([{ id: "u1" }]);

    const state = await createUser({ ...validInput, password: "x".repeat(12) });

    expect(state.success).toBe(true);
    expect(mockHashPassword).toHaveBeenCalledWith("x".repeat(12));
  });

  test("rejects an unknown role — an invalid role can never reach the insert", async () => {
    mockRequirePermission.mockResolvedValueOnce(undefined);

    const state = await createUser({ ...validInput, role: "superuser" });

    expect(state.success).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("rejects a malformed email", async () => {
    mockRequirePermission.mockResolvedValueOnce(undefined);

    const state = await createUser({ ...validInput, email: "not-an-email" });

    expect(state.success).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
