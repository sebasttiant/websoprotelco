// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

import type { SessionUser } from "../../../src/server/auth/session";

// vi.mock factories are hoisted above these declarations, so the mocks they reference
// must come from vi.hoisted rather than a plain `const` above the mock calls.
const { mockCookies, mockRedirect, mockNotFound, mockFindSessionUser } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  mockNotFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  mockFindSessionUser: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  notFound: mockNotFound,
}));

vi.mock("@/server/auth/session", () => ({
  findSessionUser: mockFindSessionUser,
}));

import {
  SESSION_COOKIE_NAME,
  getCurrentUser,
  requirePermission,
  requireSession,
  sessionCookieOptions,
} from "@/server/auth/guards";

const adminUser: SessionUser = { id: "admin-1", email: "admin@soprotelco.test", role: "admin" };
const staffUser: SessionUser = { id: "staff-1", email: "staff@soprotelco.test", role: "staff" };

function cookieStoreWith(token: string | undefined) {
  return {
    get: (name: string) => (name === SESSION_COOKIE_NAME && token ? { name, value: token } : undefined),
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("sessionCookieOptions", () => {
  const expiresAt = new Date("2030-01-01T00:00:00.000Z");

  test("keeps the session cookie inaccessible to JavaScript and cross-site requests", () => {
    const options = sessionCookieOptions(expiresAt);

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.expires).toBe(expiresAt);
  });

  test("marks the cookie secure outside development", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(sessionCookieOptions(expiresAt).secure).toBe(true);
  });

  test("allows a non-secure cookie in development so plain-HTTP localhost still works", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(sessionCookieOptions(expiresAt).secure).toBe(false);
  });
});

describe("getCurrentUser", () => {
  test("returns null instead of redirecting when there is no cookie", async () => {
    mockCookies.mockResolvedValue(cookieStoreWith(undefined));

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockFindSessionUser).not.toHaveBeenCalled();
  });
});

describe("requireSession", () => {
  test("redirects to /login when there is no cookie", async () => {
    mockCookies.mockResolvedValue(cookieStoreWith(undefined));

    await expect(requireSession()).rejects.toThrow("REDIRECT:/login");
    expect(mockFindSessionUser).not.toHaveBeenCalled();
  });

  test("redirects to /login when the cookie's token does not resolve to a user", async () => {
    mockCookies.mockResolvedValue(cookieStoreWith("stale-token"));
    mockFindSessionUser.mockResolvedValue(null);

    await expect(requireSession()).rejects.toThrow("REDIRECT:/login");
  });

  test("resolves to the session user for a valid token", async () => {
    mockCookies.mockResolvedValue(cookieStoreWith("valid-token"));
    mockFindSessionUser.mockResolvedValue(adminUser);

    await expect(requireSession()).resolves.toEqual(adminUser);
  });
});

describe("requirePermission", () => {
  test("returns 404 via notFound() when a staff session lacks the permission", async () => {
    mockCookies.mockResolvedValue(cookieStoreWith("staff-token"));
    mockFindSessionUser.mockResolvedValue(staffUser);

    await expect(requirePermission("admin:access")).rejects.toThrow("NOT_FOUND");
  });

  test("resolves to the user for a valid admin session", async () => {
    mockCookies.mockResolvedValue(cookieStoreWith("admin-token"));
    mockFindSessionUser.mockResolvedValue(adminUser);

    await expect(requirePermission("admin:access")).resolves.toEqual(adminUser);
  });

  test("redirects to /login (not notFound) when there is no session at all", async () => {
    mockCookies.mockResolvedValue(cookieStoreWith(undefined));

    await expect(requirePermission("admin:access")).rejects.toThrow("REDIRECT:/login");
    expect(mockNotFound).not.toHaveBeenCalled();
  });
});
