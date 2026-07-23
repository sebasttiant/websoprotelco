import { afterEach, describe, expect, test, vi } from "vitest";

const { mockCookies, mockCreateSession, mockQuery, mockRedirect, mockVerifyPassword } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockCreateSession: vi.fn(),
  mockQuery: vi.fn(),
  mockRedirect: vi.fn(),
  mockVerifyPassword: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mockCookies }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("@/server/db/pool", () => ({ query: mockQuery }));
vi.mock("@/server/auth/password", () => ({ verifyPassword: mockVerifyPassword }));
vi.mock("@/server/auth/session", () => ({ createSession: mockCreateSession, destroySession: vi.fn() }));

import { signIn } from "@/server/auth/actions";

function signInForm(): FormData {
  const formData = new FormData();
  formData.set("email", "user@example.com");
  formData.set("password", "correct-password");
  return formData;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("signIn", () => {
  test("rejects invalid credentials without creating a session or setting an auth cookie", async () => {
    const setCookie = vi.fn();
    mockCookies.mockResolvedValue({ set: setCookie });
    mockQuery.mockResolvedValue([{ id: "user-1", password_hash: "hash", role: "customer", is_active: true }]);
    mockVerifyPassword.mockResolvedValue(false);

    await expect(signIn({ error: null }, signInForm())).resolves.toEqual({ error: "Invalid email or password." });

    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(setCookie).not.toHaveBeenCalled();
  });

  test("rejects disabled accounts without creating a session or setting an auth cookie", async () => {
    const setCookie = vi.fn();
    mockCookies.mockResolvedValue({ set: setCookie });
    mockQuery.mockResolvedValue([{ id: "user-1", password_hash: "hash", role: "customer", is_active: false }]);
    mockVerifyPassword.mockResolvedValue(true);

    await expect(signIn({ error: null }, signInForm())).resolves.toEqual({ error: "Invalid email or password." });

    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(setCookie).not.toHaveBeenCalled();
  });

  test("creates a customer session and routes it to the account area", async () => {
    const setCookie = vi.fn();
    mockCookies.mockResolvedValue({ set: setCookie });
    mockQuery.mockResolvedValue([{ id: "user-1", password_hash: "hash", role: "customer", is_active: true }]);
    mockVerifyPassword.mockResolvedValue(true);
    mockCreateSession.mockResolvedValue({ token: "token", expiresAt: new Date("2030-01-01") });

    await signIn({ error: null }, signInForm());

    expect(mockCreateSession).toHaveBeenCalledWith("user-1");
    expect(setCookie).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith("/cuenta");
  });

  test("routes an admin session to the admin area", async () => {
    const setCookie = vi.fn();
    mockCookies.mockResolvedValue({ set: setCookie });
    mockQuery.mockResolvedValue([{ id: "admin-1", password_hash: "hash", role: "admin", is_active: true }]);
    mockVerifyPassword.mockResolvedValue(true);
    mockCreateSession.mockResolvedValue({ token: "token", expiresAt: new Date("2030-01-01") });

    await signIn({ error: null }, signInForm());

    expect(setCookie).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith("/admin");
  });
});
