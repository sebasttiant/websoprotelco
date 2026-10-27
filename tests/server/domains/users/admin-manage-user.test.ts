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

import { deleteUser, updateUser } from "@/domains/users/actions";

const actorId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";

const actor = { id: actorId, email: "admin@soprotelco.test", role: "admin" as const };

const updateInput = {
  id: otherId,
  fullName: "Staff Uno",
  email: "staff@soprotelco.test",
  role: "staff" as const,
  isActive: true,
  password: "",
};

afterEach(() => {
  mockRequirePermission.mockReset();
  mockHashPassword.mockReset();
  mockQuery.mockReset();
  mockRevalidatePath.mockReset();
});

describe("updateUser (admin action)", () => {
  test("requires admin:access and binds the actor from the session", async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error("forbidden"));

    await expect(updateUser(updateInput)).rejects.toThrow("forbidden");
    expect(mockRequirePermission).toHaveBeenCalledWith("admin:access");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("updates role and identity without rewriting the password when blank", async () => {
    mockRequirePermission.mockResolvedValueOnce(actor);
    mockQuery
      .mockResolvedValueOnce([
        {
          id: otherId,
          email: "old@soprotelco.test",
          full_name: "Old",
          role: "customer",
          is_active: true,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([]) // emailTakenByOtherUser
      .mockResolvedValueOnce([{ id: otherId }]); // update

    const state = await updateUser(updateInput);

    expect(state).toEqual({ success: true, message: "Usuario actualizado." });
    expect(mockHashPassword).not.toHaveBeenCalled();
    const updateCall = mockQuery.mock.calls.find(([sql]) => String(sql).includes("UPDATE users"));
    expect(updateCall?.[0]).not.toContain("password_hash");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  test("refuses to demote or deactivate the signed-in admin", async () => {
    mockRequirePermission.mockResolvedValueOnce(actor);
    mockQuery.mockResolvedValueOnce([
      {
        id: actorId,
        email: actor.email,
        full_name: "Yo",
        role: "admin",
        is_active: true,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const state = await updateUser({
      ...updateInput,
      id: actorId,
      role: "staff",
      isActive: false,
    });

    expect(state).toEqual({
      success: false,
      message: "No podés desactivar ni quitarte el rol de administrador a vos mismo.",
    });
    expect(mockQuery.mock.calls.length).toBe(1);
  });

  test("refuses to demote the last active admin", async () => {
    mockRequirePermission.mockResolvedValueOnce(actor);
    mockQuery
      .mockResolvedValueOnce([
        {
          id: otherId,
          email: "solo@soprotelco.test",
          full_name: "Único",
          role: "admin",
          is_active: true,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([{ count: "1" }]);

    const state = await updateUser({
      ...updateInput,
      role: "staff",
    });

    expect(state).toEqual({
      success: false,
      message: "Tiene que quedar al menos un administrador activo.",
    });
  });
});

describe("deleteUser (admin action)", () => {
  test("refuses self-delete", async () => {
    mockRequirePermission.mockResolvedValueOnce(actor);

    const state = await deleteUser({ id: actorId });

    expect(state).toEqual({ success: false, message: "No podés eliminarte a vos mismo." });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("deletes another non-last-admin user", async () => {
    mockRequirePermission.mockResolvedValueOnce(actor);
    mockQuery
      .mockResolvedValueOnce([
        {
          id: otherId,
          email: "staff@soprotelco.test",
          full_name: "Staff",
          role: "staff",
          is_active: true,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([{ id: otherId }]);

    const state = await deleteUser({ id: otherId });

    expect(state).toEqual({ success: true, message: "Usuario eliminado." });
    expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes("DELETE FROM users"))).toBe(true);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  test("refuses deleting the last active admin", async () => {
    mockRequirePermission.mockResolvedValueOnce(actor);
    mockQuery
      .mockResolvedValueOnce([
        {
          id: otherId,
          email: "otro-admin@soprotelco.test",
          full_name: "Otro",
          role: "admin",
          is_active: true,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([{ count: "1" }]);

    const state = await deleteUser({ id: otherId });

    expect(state).toEqual({
      success: false,
      message: "Tiene que quedar al menos un administrador activo.",
    });
  });
});
