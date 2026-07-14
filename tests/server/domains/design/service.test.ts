// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("@/server/db/pool", () => ({ query: mockQuery }));

import {
  createBanner,
  deleteBanner,
  getAdminBanners,
  getHeroSettings,
  getPublicBanners,
  updateBanner,
  updateHeroSettings,
} from "@/domains/design/service";

const bannerId = "44444444-4444-4444-8444-444444444444";
const userId = "11111111-1111-4111-8111-111111111111";
const bannerRow = {
  id: bannerId,
  title: "Promoción Enero",
  subtitle: "Equipos destacados",
  image_path: "/uploads/banners/3b2c1a4e-0000-4000-8000-000000000000_banner.webp",
  link_url: "https://soprotelco.com/productos",
  display_order: 1,
  is_active: true,
  start_date: "2026-01-01",
  end_date: "2026-01-31",
  created_by: userId,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("createBanner", () => {
  test("inserts a banner bound to the creating user", async () => {
    mockQuery.mockResolvedValue([]);

    await createBanner(
      {
        title: "Promoción Enero",
        subtitle: "Equipos destacados",
        imagePath: "/uploads/banners/3b2c1a4e-0000-4000-8000-000000000000_banner.webp",
        linkUrl: "https://soprotelco.com/productos",
        displayOrder: 1,
        isActive: true,
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      },
      userId,
    );

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
      userId,
    ]);
  });
});

describe("getPublicBanners", () => {
  test("returns max 5 active scheduled banners mapped to camelCase", async () => {
    mockQuery.mockResolvedValue([bannerRow]);

    const result = await getPublicBanners(new Date("2026-01-15T12:00:00.000Z"));

    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("is_active = true");
    expect(sql).toContain("start_date IS NULL OR start_date <= $1::date");
    expect(sql).toContain("end_date IS NULL OR end_date >= $1::date");
    expect(sql).toContain("LIMIT 5");
    expect(values).toEqual(["2026-01-15"]);
    expect(result).toEqual([
      {
        id: bannerId,
        title: "Promoción Enero",
        subtitle: "Equipos destacados",
        imagePath: "/uploads/banners/3b2c1a4e-0000-4000-8000-000000000000_banner.webp",
        linkUrl: "https://soprotelco.com/productos",
        displayOrder: 1,
        isActive: true,
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        createdBy: userId,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
  });
});

describe("getAdminBanners", () => {
  test("loads all banners in admin order", async () => {
    mockQuery.mockResolvedValue([bannerRow]);

    await getAdminBanners();

    const [sql] = mockQuery.mock.calls[0] as [string];
    expect(sql).toContain("ORDER BY display_order ASC, created_at DESC");
  });
});

describe("hero settings", () => {
  test("returns the singleton hero settings row", async () => {
    mockQuery.mockResolvedValue([
      {
        id: "55555555-5555-4555-8555-555555555555",
        background_image: "/uploads/hero/3b2c1a4e-0000-4000-8000-000000000001_hero.png",
        title: "Hero title",
        subtitle: "Hero subtitle",
        cta_text: "Ver productos",
        cta_link: "/productos",
        updated_by: userId,
        updated_at: "2026-01-02T00:00:00.000Z",
      },
    ]);

    await expect(getHeroSettings()).resolves.toEqual({
      id: "55555555-5555-4555-8555-555555555555",
      backgroundImage: "/uploads/hero/3b2c1a4e-0000-4000-8000-000000000001_hero.png",
      title: "Hero title",
      subtitle: "Hero subtitle",
      ctaText: "Ver productos",
      ctaLink: "/productos",
      updatedBy: userId,
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });

  test("upserts the singleton hero settings row", async () => {
    mockQuery.mockResolvedValue([]);

    await updateHeroSettings(
      {
        backgroundImage: null,
        title: "Hero title",
        subtitle: "Hero subtitle",
        ctaText: "Ver productos",
        ctaLink: "/productos",
      },
      userId,
    );

    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO hero_settings");
    expect(sql).toContain("ON CONFLICT ((id IS NOT NULL)) DO UPDATE");
    expect(values).toEqual([null, "Hero title", "Hero subtitle", "Ver productos", "/productos", userId]);
  });
});

describe("deleteBanner", () => {
  test("deletes a banner by id", async () => {
    mockQuery.mockResolvedValue([]);

    await deleteBanner(bannerId);

    expect(mockQuery).toHaveBeenCalledWith("DELETE FROM banners WHERE id = $1", [bannerId]);
  });
});

describe("updateBanner", () => {
  test("updates display order and banner metadata", async () => {
    mockQuery.mockResolvedValue([]);

    await updateBanner({
      id: bannerId,
      title: "Banner actualizado",
      subtitle: undefined,
      imagePath: "/uploads/banners/3b2c1a4e-0000-4000-8000-000000000000_banner.webp",
      linkUrl: undefined,
      displayOrder: 1,
      isActive: false,
      startDate: undefined,
      endDate: undefined,
    });

    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("UPDATE banners");
    expect(values).toEqual([
      bannerId,
      "Banner actualizado",
      null,
      "/uploads/banners/3b2c1a4e-0000-4000-8000-000000000000_banner.webp",
      null,
      1,
      false,
      null,
      null,
    ]);
  });
});
