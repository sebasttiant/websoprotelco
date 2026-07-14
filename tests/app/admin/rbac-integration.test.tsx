// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

// The point of this file is to run the REAL guards and the REAL RBAC matrix. Only the session
// lookup is faked, so nothing between the cookie and notFound()/redirect() is stubbed out.
//
// Every other admin test mocks requirePermission and asserts one page's guard in isolation.
// That is exactly why nobody noticed the admin layout was 404ing staff before any page guard
// could run: a layout gate can silently defeat every page gate, and only layout + page
// together can prove it does not.

const { mockCookies, mockFindSessionUser, mockNotFound, mockRedirect } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockFindSessionUser: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  mockRedirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/headers", () => ({ cookies: mockCookies }));
vi.mock("next/navigation", () => ({ notFound: mockNotFound, redirect: mockRedirect }));
vi.mock("@/server/auth/session", () => ({ findSessionUser: mockFindSessionUser }));

// The pages' data reads are irrelevant here; only the authorization outcome is under test.
vi.mock("@/domains/leads", () => ({
  getLeads: vi.fn().mockResolvedValue([]),
  LEAD_STATUSES: ["new", "contacted", "qualified", "converted", "lost"],
}));
vi.mock("@/domains/design", () => ({
  getAdminBanners: vi.fn().mockResolvedValue([]),
  getHeroSettings: vi.fn().mockResolvedValue({ title: "", subtitle: "", ctaText: "", ctaLink: "", backgroundImage: null }),
  createBanner: vi.fn(),
  updateBanner: vi.fn(),
  deleteBanner: vi.fn(),
  updateHeroSettings: vi.fn(),
}));
vi.mock("@/domains/settings", () => ({
  getAllSettings: vi.fn().mockResolvedValue([]),
  updateSetting: vi.fn(),
}));
vi.mock("@/domains/catalog", () => ({
  getProductsForAdmin: vi.fn().mockResolvedValue({ rows: [], total: 0, totalPages: 1, page: 1 }),
  getCategoryOptions: vi.fn().mockResolvedValue([]),
}));

const { default: AdminLayout } = await import("@/app/admin/layout");
const { default: AdminLeadsPage } = await import("@/app/admin/leads/page");
const { default: AdminDesignPage } = await import("@/app/admin/design/page");
const { default: AdminSettingsPage } = await import("@/app/admin/settings/page");

function signInAs(role: "admin" | "staff") {
  mockCookies.mockResolvedValue({ get: () => ({ value: "session-token" }) });
  mockFindSessionUser.mockResolvedValue({ id: "u1", email: `${role}@ilasesorias.com`, role });
}

// Renders the chrome and the page the way Next does: the layout gate runs first, then the page's.
async function enter(page: () => Promise<unknown>) {
  await AdminLayout({ children: null });
  await page();
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("admin authorization, layout and page together", () => {
  test("staff reaches a section its role has permission for", async () => {
    signInAs("staff");

    await expect(enter(() => AdminLeadsPage({ searchParams: Promise.resolve({}) }))).resolves.not.toThrow();
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  test("staff is refused a section its role has no permission for", async () => {
    signInAs("staff");

    await expect(enter(() => AdminDesignPage())).rejects.toThrow("NEXT_NOT_FOUND");
  });

  test("staff is refused settings", async () => {
    signInAs("staff");

    await expect(enter(() => AdminSettingsPage())).rejects.toThrow("NEXT_NOT_FOUND");
  });

  test("admin reaches every section", async () => {
    signInAs("admin");

    await expect(enter(() => AdminLeadsPage({ searchParams: Promise.resolve({}) }))).resolves.not.toThrow();
    await expect(enter(() => AdminDesignPage())).resolves.not.toThrow();
    await expect(enter(() => AdminSettingsPage())).resolves.not.toThrow();
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  test("a signed-out visitor is sent to login by the layout, before any page runs", async () => {
    mockCookies.mockResolvedValue({ get: () => undefined });
    mockFindSessionUser.mockResolvedValue(null);

    await expect(AdminLayout({ children: null })).rejects.toThrow("NEXT_REDIRECT");
  });
});
