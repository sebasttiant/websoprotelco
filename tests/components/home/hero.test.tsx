import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { BannerSummary, HeroSettings } from "@/domains/design";

const { mockGetPublicBanners, mockGetHeroSettings } = vi.hoisted(() => ({
  mockGetPublicBanners: vi.fn(),
  mockGetHeroSettings: vi.fn(),
}));

vi.mock("@/domains/design", () => ({
  getPublicBanners: mockGetPublicBanners,
  getHeroSettings: mockGetHeroSettings,
}));

const { Hero } = await import("@/components/home/hero");

const HERO_SETTINGS: HeroSettings = {
  id: null,
  backgroundImage: null,
  title: "Productos y equipos para redes confiables",
  subtitle: "SOPROTELCO acompaña tus proyectos de telecomunicaciones.",
  ctaText: "Ver productos",
  ctaLink: "/productos",
  updatedBy: null,
  updatedAt: null,
};

function banner(overrides: Partial<BannerSummary> = {}): BannerSummary {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Fusionadoras en stock",
    subtitle: "Entrega inmediata",
    imagePath: "/uploads/banners/11111111-1111-4111-8111-111111111111_promo.jpg",
    linkUrl: "https://soprotelco.com/promo",
    displayOrder: 0,
    isActive: true,
    startDate: null,
    endDate: null,
    createdBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

async function renderHero(banners: BannerSummary[], settings: HeroSettings = HERO_SETTINGS) {
  mockGetPublicBanners.mockResolvedValue(banners);
  mockGetHeroSettings.mockResolvedValue(settings);
  render(await Hero());
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("Hero without banners", () => {
  test("falls back to the hero settings copy instead of hardcoded text", async () => {
    await renderHero([], {
      ...HERO_SETTINGS,
      title: "Tu aliado en fibra óptica",
      subtitle: "Stock disponible y envíos nacionales.",
    });

    expect(screen.getByRole("heading", { level: 1, name: "Tu aliado en fibra óptica" })).toBeInTheDocument();
    expect(screen.getByText("Stock disponible y envíos nacionales.")).toBeInTheDocument();
  });

  test("keeps the home layout usable when its optional background image is absent", async () => {
    await renderHero([], { ...HERO_SETTINGS, backgroundImage: null });

    expect(screen.getByRole("heading", { level: 1, name: HERO_SETTINGS.title })).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("renders the call to action from hero settings", async () => {
    await renderHero([], { ...HERO_SETTINGS, ctaText: "Ver catálogo", ctaLink: "/productos" });

    expect(screen.getByRole("link", { name: "Ver catálogo" })).toHaveAttribute("href", "/productos");
  });

  test("does not pass unsafe persisted CTA links to next/link", async () => {
    await renderHero([], { ...HERO_SETTINGS, ctaText: "Ver catálogo", ctaLink: "javascript:alert(1)" });

    expect(screen.getByRole("link", { name: "Ver catálogo" })).toHaveAttribute("href", "/productos");
  });

  test("does not render a carousel", async () => {
    await renderHero([]);

    expect(screen.queryByRole("region", { name: /destacados/i })).not.toBeInTheDocument();
  });
});

describe("Hero with banners", () => {
  test("renders the banner carousel instead of the static hero", async () => {
    await renderHero([banner({ title: "Fusionadoras en stock" })]);

    expect(screen.getByRole("region", { name: /destacados/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Fusionadoras en stock" })).toBeInTheDocument();
  });

  test("shows the first banner and keeps the rest mounted for navigation", async () => {
    await renderHero([
      banner({ id: "aaaaaaaa-1111-4111-8111-111111111111", title: "Primero" }),
      banner({ id: "bbbbbbbb-2222-4222-8222-222222222222", title: "Segundo" }),
    ]);

    expect(screen.getByRole("heading", { level: 1, name: "Primero" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /ir al banner/i })).toHaveLength(2);
  });

  test("does not render an unsafe persisted banner link", async () => {
    await renderHero([banner({ linkUrl: "javascript:alert(1)" })]);

    expect(screen.queryByRole("link", { name: "Ver más" })).not.toBeInTheDocument();
  });
});
