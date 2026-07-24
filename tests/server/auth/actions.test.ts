import { afterEach, describe, expect, test, vi } from "vitest";

const { mockCookies, mockCreateSession, mockQuery, mockRedirect, mockVerifyPassword, mockHashPassword } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockCreateSession: vi.fn(),
  mockQuery: vi.fn(),
  mockRedirect: vi.fn(),
  mockVerifyPassword: vi.fn(),
  mockHashPassword: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mockCookies }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("@/server/db/pool", () => ({ query: mockQuery }));
vi.mock("@/server/auth/password", () => ({ verifyPassword: mockVerifyPassword, hashPassword: mockHashPassword }));
vi.mock("@/server/auth/session", () => ({ createSession: mockCreateSession, destroySession: vi.fn() }));

import { signIn, signUp } from "@/server/auth/actions";

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

function signUpForm(email = "nueva@empresa.com", password = "unaClaveSegura"): FormData {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", password);
  return formData;
}

describe("signUp", () => {
  test("creates a customer account, sets the cookie, and lands on the account area", async () => {
    const setCookie = vi.fn();
    mockCookies.mockResolvedValue({ set: setCookie });
    mockHashPassword.mockResolvedValue("hashed");
    mockQuery.mockResolvedValue([{ id: "user-1" }]);
    mockCreateSession.mockResolvedValue({ token: "token", expiresAt: new Date("2030-01-01") });

    await signUp({ error: null }, signUpForm());

    // The inserted role is always 'customer' — signup can never mint a privileged account.
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("'customer'"), ["nueva@empresa.com", "hashed"]);
    expect(mockCreateSession).toHaveBeenCalledWith("user-1");
    expect(setCookie).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith("/cuenta");
  });

  test("reports a taken email without creating a session", async () => {
    const setCookie = vi.fn();
    mockCookies.mockResolvedValue({ set: setCookie });
    mockHashPassword.mockResolvedValue("hashed");
    mockQuery.mockResolvedValue([]); // ON CONFLICT DO NOTHING returned no row

    await expect(signUp({ error: null }, signUpForm())).resolves.toEqual({
      error: "Ese correo ya está registrado. Iniciá sesión.",
    });

    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(setCookie).not.toHaveBeenCalled();
  });

  test("rejects a short password before touching the database", async () => {
    const result = await signUp({ error: null }, signUpForm("nueva@empresa.com", "corta"));

    expect(result.error).toContain("al menos 8");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("rejects a malformed email before touching the database", async () => {
    const result = await signUp({ error: null }, signUpForm("no-es-un-email", "unaClaveSegura"));

    expect(result.error).toContain("correo");
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
