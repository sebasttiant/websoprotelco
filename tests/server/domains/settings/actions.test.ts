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
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { updateSetting } from "@/domains/settings";

const adminId = "11111111-1111-4111-8111-111111111111";

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

describe("updateSetting", () => {
  test("requires the settings:write permission before writing", async () => {
    mockRequirePermission.mockResolvedValue({ id: adminId, email: "admin@soprotelco.test", role: "admin" });
    mockQuery.mockResolvedValue([]);

    await expect(updateSetting(formData({ key: "site_name", value: "SOPROTELCO SAS" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(mockRequirePermission).toHaveBeenCalledWith("settings:write");
  });

  test("updates the setting, revalidates admin and public paths, and redirects", async () => {
    mockRequirePermission.mockResolvedValue({ id: adminId, email: "admin@soprotelco.test", role: "admin" });
    mockQuery.mockResolvedValue([]);

    await expect(updateSetting(formData({ key: "site_name", value: "SOPROTELCO SAS" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(mockQuery).toHaveBeenCalledWith(
      "UPDATE settings SET value = $2, updated_by = $3, updated_at = NOW() WHERE key = $1",
      ["site_name", "SOPROTELCO SAS", adminId],
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/settings");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
    expect(mockRedirect).toHaveBeenCalledWith("/admin/settings?success=setting-updated");
  });

  test("returns a validation error for an invalid key and never writes", async () => {
    mockRequirePermission.mockResolvedValue({ id: adminId, email: "admin@soprotelco.test", role: "admin" });

    const result = await updateSetting(formData({ key: "Invalid Key!", value: "x" }));

    expect(result.success).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("returns a validation error for an invalid contact_email value", async () => {
    mockRequirePermission.mockResolvedValue({ id: adminId, email: "admin@soprotelco.test", role: "admin" });

    const result = await updateSetting(formData({ key: "contact_email", value: "not-an-email" }));

    expect(result).toEqual({ success: false, message: "A valid email is required for contact_email." });
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
