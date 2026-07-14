// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock("@/server/db/pool", () => ({
  query: mockQuery,
}));

import { DEFAULT_SITE_SETTINGS, getSiteSettings } from "@/domains/settings/service";

// The repository selects every column, but only key/value drive the read model.
function row(key: string, value: string | null) {
  return { id: key, key, value, description: null, updated_at: "2026-01-01T00:00:00.000Z" };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getSiteSettings", () => {
  test("maps the seeded keys into a typed read model", async () => {
    mockQuery.mockResolvedValue([
      row("site_name", "SOPROTELCO"),
      row("site_description", "Soluciones en telecomunicaciones."),
      row("contact_email", "ventas@soprotelco.com"),
      row("contact_phone", "+57 300 123 4567"),
      row("address", "Bogotá, Colombia"),
      row("business_hours", "Lun-Vie: 8:00-18:00"),
      row("facebook_url", "https://facebook.com/soprotelco"),
      row("instagram_url", "https://instagram.com/soprotelco"),
      row("linkedin_url", "https://linkedin.com/company/soprotelco"),
      row("whatsapp_number", "+573001234567"),
    ]);

    expect(await getSiteSettings()).toEqual({
      siteName: "SOPROTELCO",
      siteDescription: "Soluciones en telecomunicaciones.",
      contactEmail: "ventas@soprotelco.com",
      contactPhone: "+57 300 123 4567",
      address: "Bogotá, Colombia",
      businessHours: "Lun-Vie: 8:00-18:00",
      facebookUrl: "https://facebook.com/soprotelco",
      instagramUrl: "https://instagram.com/soprotelco",
      linkedinUrl: "https://linkedin.com/company/soprotelco",
      whatsappNumber: "+573001234567",
    });
  });

  test("treats a blank social URL as absent so the UI can skip the icon", async () => {
    // The seed ships the three social keys with an empty string, so "present but blank"
    // is the default state of a fresh install, not an edge case.
    mockQuery.mockResolvedValue([
      row("facebook_url", ""),
      row("instagram_url", "   "),
      row("linkedin_url", null),
    ]);

    const settings = await getSiteSettings();

    expect(settings.facebookUrl).toBeNull();
    expect(settings.instagramUrl).toBeNull();
    expect(settings.linkedinUrl).toBeNull();
  });

  test("falls back to a default when a required key is missing entirely", async () => {
    mockQuery.mockResolvedValue([row("site_name", "SOPROTELCO")]);

    const settings = await getSiteSettings();

    expect(settings.siteName).toBe("SOPROTELCO");
    expect(settings.contactEmail).toBe(DEFAULT_SITE_SETTINGS.contactEmail);
    expect(settings.businessHours).toBe(DEFAULT_SITE_SETTINGS.businessHours);
  });

  test("falls back to a default when a required key is present but blank", async () => {
    mockQuery.mockResolvedValue([row("contact_phone", "")]);

    expect((await getSiteSettings()).contactPhone).toBe(DEFAULT_SITE_SETTINGS.contactPhone);
  });

  test("returns the full defaults when the settings table is empty", async () => {
    mockQuery.mockResolvedValue([]);

    expect(await getSiteSettings()).toEqual(DEFAULT_SITE_SETTINGS);
  });

  test("ignores keys that are not part of the site read model", async () => {
    mockQuery.mockResolvedValue([row("site_name", "SOPROTELCO"), row("some_future_flag", "on")]);

    expect(await getSiteSettings()).not.toHaveProperty("some_future_flag");
  });
});
