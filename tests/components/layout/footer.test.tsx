import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { SiteSettings } from "@/domains/settings/schemas";

const { mockGetSiteSettings } = vi.hoisted(() => ({
  mockGetSiteSettings: vi.fn(),
}));

vi.mock("@/domains/settings", () => ({
  getSiteSettings: mockGetSiteSettings,
}));

const { Footer } = await import("@/components/layout/footer");

const SETTINGS: SiteSettings = {
  siteName: "SOPROTELCO",
  siteDescription: "Soluciones integrales en telecomunicaciones.",
  contactEmail: "ventas@soprotelco.com",
  contactPhone: "+57 300 123 4567",
  address: "Bogotá, Colombia",
  businessHours: "Lun-Vie: 8:00-18:00",
  facebookUrl: null,
  instagramUrl: null,
  linkedinUrl: null,
  whatsappNumber: "+573001234567",
};

async function renderFooter(overrides: Partial<SiteSettings> = {}) {
  mockGetSiteSettings.mockResolvedValue({ ...SETTINGS, ...overrides });
  render(await Footer());
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("Footer", () => {
  test("renders the company identity from settings", async () => {
    await renderFooter({ siteName: "SOPROTELCO", siteDescription: "Fibra óptica y redes." });

    expect(screen.getByRole("img", { name: /soprotelco/i })).toHaveAttribute(
      "src",
      expect.stringContaining("soprotelco-logo-white"),
    );
    expect(screen.getByText("Fibra óptica y redes.")).toBeInTheDocument();
  });

  test("renders the contact details from settings", async () => {
    await renderFooter({
      contactPhone: "+57 311 555 0000",
      contactEmail: "hola@soprotelco.com",
      address: "Medellín, Colombia",
      businessHours: "Lun-Vie: 7:00-17:00",
    });

    const contact = screen.getByRole("region", { name: /contacto/i });
    expect(within(contact).getByRole("link", { name: "+57 311 555 0000" })).toHaveAttribute(
      "href",
      "tel:+573115550000",
    );
    expect(within(contact).getByRole("link", { name: "hola@soprotelco.com" })).toHaveAttribute(
      "href",
      "mailto:hola@soprotelco.com",
    );
    expect(within(contact).getByText("Medellín, Colombia")).toBeInTheDocument();
    expect(within(contact).getByText("Lun-Vie: 7:00-17:00")).toBeInTheDocument();
  });

  test("renders a social link only when settings provide a URL", async () => {
    await renderFooter({
      facebookUrl: "https://facebook.com/soprotelco",
      instagramUrl: null,
      linkedinUrl: null,
    });

    expect(screen.getByRole("link", { name: /facebook/i })).toHaveAttribute(
      "href",
      "https://facebook.com/soprotelco",
    );
    expect(screen.queryByRole("link", { name: /instagram/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /linkedin/i })).not.toBeInTheDocument();
  });

  test("omits the social section entirely when no network is configured", async () => {
    // The seed ships every social key blank, so this is a fresh install's default state.
    await renderFooter();

    expect(screen.queryByRole("region", { name: /redes/i })).not.toBeInTheDocument();
  });

  test("keeps the company navigation links", async () => {
    await renderFooter();

    const nav = screen.getByRole("navigation", { name: /empresa/i });
    expect(within(nav).getByRole("link", { name: "Productos" })).toHaveAttribute("href", "/productos");
    expect(within(nav).getByRole("link", { name: "Contacto" })).toHaveAttribute("href", "/contacto");
  });

  test("links the legal pages", async () => {
    await renderFooter();

    expect(screen.getByRole("link", { name: /términos/i })).toHaveAttribute("href", "/terminos");
    expect(screen.getByRole("link", { name: /privacidad/i })).toHaveAttribute("href", "/privacidad");
  });

  test("shows the current year in the copyright", async () => {
    await renderFooter({ siteName: "SOPROTELCO" });

    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`© ${year} SOPROTELCO`))).toBeInTheDocument();
  });
});
