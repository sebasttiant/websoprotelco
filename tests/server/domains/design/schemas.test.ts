// @vitest-environment node
import { describe, expect, test } from "vitest";

import {
  bannerCreateInputSchema,
  bannerDeleteInputSchema,
  bannerUpdateInputSchema,
  heroSettingsUpdateInputSchema,
  isSafeDesignImagePath,
} from "@/domains/design/schemas";

const bannerImagePath = "/uploads/banners/3b2c1a4e-0000-4000-8000-000000000000_banner.webp";
const heroImagePath = "/uploads/hero/3b2c1a4e-0000-4000-8000-000000000001_hero.png";
const bannerId = "44444444-4444-4444-8444-444444444444";

describe("bannerCreateInputSchema", () => {
  test("accepts a full valid banner payload", () => {
    const result = bannerCreateInputSchema.safeParse({
      title: "Promoción Enero",
      subtitle: "Equipos destacados para redes FTTH.",
      imagePath: bannerImagePath,
      linkUrl: "https://soprotelco.com/productos",
      displayOrder: 1,
      isActive: true,
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });

    expect(result.success).toBe(true);
  });

  test("defaults display order and active state", () => {
    const result = bannerCreateInputSchema.safeParse({
      title: "Banner principal",
      imagePath: bannerImagePath,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayOrder).toBe(0);
      expect(result.data.isActive).toBe(true);
    }
  });

  test("rejects a missing title", () => {
    const result = bannerCreateInputSchema.safeParse({ title: "", imagePath: bannerImagePath });

    expect(result.success).toBe(false);
  });

  test("rejects a title longer than 200 characters", () => {
    const result = bannerCreateInputSchema.safeParse({ title: "x".repeat(201), imagePath: bannerImagePath });

    expect(result.success).toBe(false);
  });

  test("rejects a subtitle longer than 500 characters", () => {
    const result = bannerCreateInputSchema.safeParse({
      title: "Banner",
      subtitle: "x".repeat(501),
      imagePath: bannerImagePath,
    });

    expect(result.success).toBe(false);
  });

  test.each(["javascript:alert(1)", "//evil.example.com/x", "/uploads/products/x.jpg", "/etc/passwd"])(
    "rejects an unsafe imagePath: %s",
    (imagePath) => {
      const result = bannerCreateInputSchema.safeParse({ title: "Banner", imagePath });

      expect(result.success).toBe(false);
    },
  );

  test("rejects an invalid link URL", () => {
    const result = bannerCreateInputSchema.safeParse({
      title: "Banner",
      imagePath: bannerImagePath,
      linkUrl: "not-a-url",
    });

    expect(result.success).toBe(false);
  });

  test("rejects an end date before the start date", () => {
    const result = bannerCreateInputSchema.safeParse({
      title: "Scheduled banner",
      imagePath: bannerImagePath,
      startDate: "2026-02-01",
      endDate: "2026-01-31",
    });

    expect(result.success).toBe(false);
  });
});

describe("heroSettingsUpdateInputSchema", () => {
  test("accepts a valid hero settings payload", () => {
    const result = heroSettingsUpdateInputSchema.safeParse({
      backgroundImage: heroImagePath,
      title: "Tu aliado en fibra óptica",
      subtitle: "Equipos y suministros con asesoría experta.",
      ctaText: "Ver productos",
      ctaLink: "/productos",
    });

    expect(result.success).toBe(true);
  });

  test("accepts a blank background image as null", () => {
    const result = heroSettingsUpdateInputSchema.safeParse({
      backgroundImage: "",
      title: "Hero",
      subtitle: "Subtitle",
      ctaText: "Comprar",
      ctaLink: "/productos",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.backgroundImage).toBeNull();
    }
  });

  test("rejects an unsafe background image", () => {
    const result = heroSettingsUpdateInputSchema.safeParse({
      backgroundImage: "https://evil.example.com/hero.jpg",
      title: "Hero",
      subtitle: "Subtitle",
      ctaText: "Comprar",
      ctaLink: "/productos",
    });

    expect(result.success).toBe(false);
  });
});

describe("bannerDeleteInputSchema", () => {
  test("accepts a valid uuid", () => {
    expect(bannerDeleteInputSchema.safeParse({ id: bannerId }).success).toBe(true);
  });

  test("rejects a non-uuid id", () => {
    expect(bannerDeleteInputSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false);
  });
});

describe("bannerUpdateInputSchema", () => {
  test("accepts a valid banner update payload", () => {
    const result = bannerUpdateInputSchema.safeParse({
      id: bannerId,
      title: "Banner actualizado",
      imagePath: bannerImagePath,
      displayOrder: 1,
      isActive: false,
    });

    expect(result.success).toBe(true);
  });

  test("rejects a non-uuid id", () => {
    const result = bannerUpdateInputSchema.safeParse({
      id: "not-a-uuid",
      title: "Banner actualizado",
      imagePath: bannerImagePath,
    });

    expect(result.success).toBe(false);
  });
});

describe("isSafeDesignImagePath", () => {
  test("accepts banner and hero upload paths", () => {
    expect(isSafeDesignImagePath(bannerImagePath)).toBe(true);
    expect(isSafeDesignImagePath(heroImagePath)).toBe(true);
  });

  test.each(["javascript:alert(1)", "//evil.example.com/x", "http://evil.com/x.jpg", "/uploads/products/x.jpg"])(
    "rejects unsafe paths: %s",
    (path) => {
      expect(isSafeDesignImagePath(path)).toBe(false);
    },
  );
});
