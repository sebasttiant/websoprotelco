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

vi.mock("@/server/auth/guards", () => ({ requirePermission: mockRequirePermission }));
vi.mock("@/server/db/pool", () => ({ query: mockQuery }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

import { createBanner, deleteBanner, updateBanner, updateHeroSettings } from "@/domains/design/actions";

const adminId = "11111111-1111-4111-8111-111111111111";
const bannerId = "44444444-4444-4444-8444-444444444444";

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

describe("createBanner", () => {
  test("requires design:write and creates a banner", async () => {
    mockRequirePermission.mockResolvedValue({ id: adminId, email: "admin@soprotelco.test", role: "admin" });
    mockQuery.mockResolvedValue([]);

    await expect(
      createBanner(
        formData({
          title: "Promoción Enero",
          subtitle: "Equipos destacados",
          imagePath: "/uploads/banners/3b2c1a4e-0000-4000-8000-000000000000_banner.webp",
          linkUrl: "https://soprotelco.com/productos",
          displayOrder: "1",
          isActive: "on",
          startDate: "2026-01-01",
          endDate: "2026-01-31",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRequirePermission).toHaveBeenCalledWith("design:write");
    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO banners");
    expect(values).toEqual([
      "Promoción Enero",
      "Equipos destacados",
      "/uploads/banners/3b2c1a4e-0000-4000-8000-000000000000_banner.webp",
      "https://soprotelco.com/productos",
      1,
      true,
      "2026-01-01",
      "2026-01-31",
      adminId,
    ]);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/design");
    expect(mockRedirect).toHaveBeenCalledWith("/admin/design?success=banner-created");
  });

  test("checks permission before parsing", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await expect(createBanner(formData({ title: "", imagePath: "" }))).rejects.toThrow("forbidden");

    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe("updateHeroSettings", () => {
  test("requires design:write and updates hero settings", async () => {
    mockRequirePermission.mockResolvedValue({ id: adminId, email: "admin@soprotelco.test", role: "admin" });
    mockQuery.mockResolvedValue([]);

    await expect(
      updateHeroSettings(
        formData({
          backgroundImage: "/uploads/hero/3b2c1a4e-0000-4000-8000-000000000001_hero.png",
          title: "Hero title",
          subtitle: "Hero subtitle",
          ctaText: "Ver productos",
          ctaLink: "/productos",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRequirePermission).toHaveBeenCalledWith("design:write");
    expect(mockQuery.mock.calls[0]?.[0]).toContain("INSERT INTO hero_settings");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/design");
    expect(mockRedirect).toHaveBeenCalledWith("/admin/design?success=hero-updated");
  });

  test("redirects validation errors so unsafe CTA links are visible on the page", async () => {
    mockRequirePermission.mockResolvedValue({ id: adminId, email: "admin@soprotelco.test", role: "admin" });

    await expect(updateHeroSettings(formData({ backgroundImage: "", title: "Hero", subtitle: "Subtitle", ctaText: "Ver", ctaLink: "javascript:alert(1)" }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith("/admin/design?error=validation");
  });
});

describe("deleteBanner", () => {
  test("requires design:write and deletes a banner", async () => {
    mockRequirePermission.mockResolvedValue({ id: adminId, email: "admin@soprotelco.test", role: "admin" });
    mockQuery.mockResolvedValue([]);

    await expect(deleteBanner(formData({ id: bannerId }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRequirePermission).toHaveBeenCalledWith("design:write");
    expect(mockQuery).toHaveBeenCalledWith("DELETE FROM banners WHERE id = $1", [bannerId]);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/design");
    expect(mockRedirect).toHaveBeenCalledWith("/admin/design?success=banner-deleted");
  });

  test("returns validation errors without deleting", async () => {
    mockRequirePermission.mockResolvedValue({ id: adminId, email: "admin@soprotelco.test", role: "admin" });

    const result = await deleteBanner(formData({ id: "not-a-uuid" }));

    expect(result.success).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe("updateBanner", () => {
  test("requires design:write and updates a banner", async () => {
    mockRequirePermission.mockResolvedValue({ id: adminId, email: "admin@soprotelco.test", role: "admin" });
    mockQuery.mockResolvedValue([]);

    await expect(
      updateBanner(
        formData({
          id: bannerId,
          title: "Banner actualizado",
          imagePath: "/uploads/banners/3b2c1a4e-0000-4000-8000-000000000000_banner.webp",
          displayOrder: "1",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRequirePermission).toHaveBeenCalledWith("design:write");
    expect(mockQuery.mock.calls[0]?.[0]).toContain("UPDATE banners");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/design");
    expect(mockRedirect).toHaveBeenCalledWith("/admin/design?success=banner-updated");
  });
});
