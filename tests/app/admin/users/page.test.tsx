// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockRequirePermission, mockGetUsersForAdmin } = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockGetUsersForAdmin: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/domains/users", () => ({
  getUsersForAdmin: mockGetUsersForAdmin,
}));

// The table/badge components are irrelevant to the guard behavior under test.
vi.mock("@/components/admin/data-table", () => ({
  DataTable: () => null,
}));

vi.mock("@/components/admin/status-badge", () => ({
  StatusBadge: () => null,
}));

import AdminUsersPage from "@/app/admin/users/page";

afterEach(() => {
  vi.clearAllMocks();
});

describe("AdminUsersPage guard", () => {
  test("requires admin:access before any user query runs", async () => {
    mockRequirePermission.mockRejectedValue(new Error("NEXT_NOT_FOUND"));

    await expect(AdminUsersPage()).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockRequirePermission).toHaveBeenCalledWith("admin:access");
    expect(mockGetUsersForAdmin).not.toHaveBeenCalled();
  });

  test("lists users once the admin:access guard passes", async () => {
    mockRequirePermission.mockResolvedValue({ id: "admin-id", email: "admin@soprotelco.test", role: "admin" });
    mockGetUsersForAdmin.mockResolvedValue([]);

    await AdminUsersPage();

    expect(mockRequirePermission).toHaveBeenCalledWith("admin:access");
    expect(mockGetUsersForAdmin).toHaveBeenCalledTimes(1);
  });
});
