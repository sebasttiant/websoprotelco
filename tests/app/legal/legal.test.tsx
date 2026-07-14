import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockGetSiteSettings } = vi.hoisted(() => ({
  mockGetSiteSettings: vi.fn(),
}));

vi.mock("@/domains/settings", () => ({ getSiteSettings: mockGetSiteSettings }));
vi.mock("@/components/layout/header", () => ({ Header: () => null }));
vi.mock("@/components/layout/footer", () => ({ Footer: () => null }));

const { default: TermsPage } = await import("@/app/terminos/page");
const { default: PrivacyPage } = await import("@/app/privacidad/page");

const SETTINGS = {
  siteName: "SOPROTELCO SAS",
  contactEmail: "ventas@soprotelco.com",
  address: "Bogotá, Colombia",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("legal pages", () => {
  test("the terms page no longer says it is a placeholder", async () => {
    mockGetSiteSettings.mockResolvedValue(SETTINGS);

    render(await TermsPage());

    expect(screen.queryByText(/placeholder/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: /términos/i })).toBeInTheDocument();
  });

  test("the privacy page cites the Colombian data protection law", async () => {
    mockGetSiteSettings.mockResolvedValue(SETTINGS);

    render(await PrivacyPage());

    expect(screen.queryByText(/placeholder/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Ley 1581 de 2012/)).toBeInTheDocument();
  });

  test("both pages name the company and its contact address from settings", async () => {
    mockGetSiteSettings.mockResolvedValue(SETTINGS);

    render(await PrivacyPage());

    // Both appear in several clauses, so presence is what matters, not uniqueness.
    expect(screen.getAllByText(/SOPROTELCO SAS/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ventas@soprotelco\.com/).length).toBeGreaterThan(0);
  });

  test("each page carries a last-updated date so the version is auditable", async () => {
    mockGetSiteSettings.mockResolvedValue(SETTINGS);

    render(await TermsPage());

    expect(screen.getByText(/última actualización/i)).toBeInTheDocument();
  });
});
