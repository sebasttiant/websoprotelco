import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

const { mockRequirePermission } = vi.hoisted(() => ({ mockRequirePermission: vi.fn() }));

vi.mock("@/server/auth/guards", () => ({ requirePermission: mockRequirePermission }));
vi.mock("@/domains/design", () => ({
  createBanner: vi.fn(),
  deleteBanner: vi.fn(),
  getAdminBanners: vi.fn(async () => []),
  getHeroSettings: vi.fn(async () => ({ id: null, backgroundImage: null, title: "Hero", subtitle: "Subtitle", ctaText: "Ver", ctaLink: "/productos", updatedBy: null, updatedAt: null })),
  isSafeDesignImagePath: vi.fn(() => true),
  updateBanner: vi.fn(),
  updateHeroSettings: vi.fn(),
}));

const { default: AdminDesignPage } = await import("@/app/admin/design/page");

const id = "11111111-1111-4111-8111-111111111111";

describe("design error contracts", () => {
  test("renders design errors accessibly and accepts internal link text input", async () => {
    mockRequirePermission.mockResolvedValue({ id, role: "admin" });
    render(await AdminDesignPage({ searchParams: Promise.resolve({ error: "validation" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent(/no se pudo guardar el diseño/i);
    expect(screen.getByLabelText("URL de enlace")).toHaveAttribute("type", "text");
  });
});
