import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { SiteSettings } from "@/domains/settings/schemas";

const { mockGetSiteSettings, mockGetCurrentUser } = vi.hoisted(() => ({
  mockGetSiteSettings: vi.fn(),
  mockGetCurrentUser: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/server/auth/actions", () => ({
  signOut: vi.fn(),
}));

// Declared here rather than imported from the service: the domain is mocked below, and the
// service module would drag the pg pool into a jsdom test.
const SETTINGS: SiteSettings = {
  siteName: "SOPROTELCO",
  siteDescription: "Soluciones en telecomunicaciones.",
  contactEmail: "ventas@soprotelco.com",
  contactPhone: "+57 300 123 4567",
  address: "Bogotá, Colombia",
  businessHours: "Lun-Vie: 8:00-18:00",
  facebookUrl: null,
  instagramUrl: null,
  linkedinUrl: null,
  whatsappNumber: "+573001234567",
};

// The header is a server component that reads the settings domain. Mocking the domain's
// public surface keeps the test off the database while still exercising the real mapping
// of a SiteSettings read model onto markup.
vi.mock("@/domains/settings", () => ({
  getSiteSettings: mockGetSiteSettings,
}));

const { Header } = await import("@/components/layout/header");

async function renderHeader(overrides: Partial<SiteSettings> = {}, user: unknown = null) {
  mockGetSiteSettings.mockResolvedValue({ ...SETTINGS, ...overrides });
  mockGetCurrentUser.mockResolvedValue(user);
  render(await Header());
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("Header", () => {
  test("renders the logo image rather than a text badge", async () => {
    await renderHeader({ siteName: "SOPROTELCO" });

    const logo = screen.getByRole("img", { name: /soprotelco/i });
    expect(logo).toHaveAttribute("src", expect.stringContaining("sp-logo"));
  });

  test("links the logo back to the home page", async () => {
    await renderHeader();

    expect(screen.getByRole("link", { name: /soprotelco/i })).toHaveAttribute("href", "/");
  });

  test("shows the contact phone and business hours from settings", async () => {
    await renderHeader({
      contactPhone: "+57 311 999 0000",
      businessHours: "Lun-Vie: 7:00-17:00",
    });

    const topBar = screen.getByRole("complementary", { name: /contacto/i });
    expect(within(topBar).getByText("+57 311 999 0000")).toBeInTheDocument();
    expect(within(topBar).getByText("Lun-Vie: 7:00-17:00")).toBeInTheDocument();
  });

  test("makes the phone number callable", async () => {
    await renderHeader({ contactPhone: "+57 311 999 0000" });

    // The href strips spaces because tel: URIs must not contain them.
    expect(screen.getByRole("link", { name: "+57 311 999 0000" })).toHaveAttribute(
      "href",
      "tel:+573119990000",
    );
  });

  test("renders the main navigation links", async () => {
    await renderHeader();

    const nav = screen.getByRole("navigation", { name: /principal/i });
    expect(within(nav).getByRole("link", { name: "Inicio" })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: "Productos" })).toHaveAttribute("href", "/productos");
    expect(within(nav).getByRole("link", { name: "Contacto" })).toHaveAttribute("href", "/contacto");
  });

  test("offers login to a signed-out visitor", async () => {
    await renderHeader({}, null);

    expect(screen.getByRole("link", { name: /iniciar sesión/i })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("link", { name: /mi cuenta/i })).not.toBeInTheDocument();
  });

  test("swaps login for the account link once a visitor is signed in", async () => {
    // A signed-in customer was still being told to "Iniciar sesión", with no way out.
    await renderHeader({}, { id: "user-1", email: "ana@empresa.com", role: "customer" });

    expect(screen.getByRole("link", { name: /mi cuenta/i })).toHaveAttribute("href", "/cuenta");
    expect(screen.queryByRole("link", { name: /iniciar sesión/i })).not.toBeInTheDocument();
  });

  test("gives a signed-in visitor a way to sign out", async () => {
    await renderHeader({}, { id: "user-1", email: "ana@empresa.com", role: "customer" });

    expect(screen.getByRole("button", { name: /cerrar sesión/i })).toBeInTheDocument();
  });
});
