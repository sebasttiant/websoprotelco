import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockRequireSession, mockGetAccountOverview, mockGetQuotesForUser } = vi.hoisted(() => ({
  mockRequireSession: vi.fn(),
  mockGetAccountOverview: vi.fn(),
  mockGetQuotesForUser: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/domains/users", () => ({
  getAccountOverview: mockGetAccountOverview,
}));

vi.mock("@/domains/quote-order", () => ({
  getQuotesForUser: mockGetQuotesForUser,
}));

const { default: AccountPage } = await import("@/app/cuenta/page");

const SESSION = { id: "user-1", email: "cliente@empresa.com", role: "customer" };

afterEach(() => {
  vi.clearAllMocks();
});

describe("AccountPage guard", () => {
  test("requires a session before reading any account data", async () => {
    mockRequireSession.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(AccountPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(mockGetAccountOverview).not.toHaveBeenCalled();
    expect(mockGetQuotesForUser).not.toHaveBeenCalled();
  });
});

describe("AccountPage", () => {
  async function renderPage(quotes: unknown[] = []) {
    mockRequireSession.mockResolvedValue(SESSION);
    mockGetAccountOverview.mockResolvedValue({
      fullName: "Ana Torres",
      email: "ana@empresa.com",
      role: "customer",
    });
    mockGetQuotesForUser.mockResolvedValue(quotes);
    render(await AccountPage());
  }

  test("greets the customer in Spanish, matching the rest of the site", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1, name: /mi cuenta/i })).toBeInTheDocument();
  });

  test("shows the profile details from the account", async () => {
    await renderPage();

    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
    expect(screen.getByText("ana@empresa.com")).toBeInTheDocument();
  });

  test("links to the profile and password pages", async () => {
    await renderPage();

    expect(screen.getByRole("link", { name: /editar perfil/i })).toHaveAttribute("href", "/cuenta/perfil");
    expect(screen.getByRole("link", { name: /cambiar contraseña/i })).toHaveAttribute(
      "href",
      "/cuenta/password",
    );
  });

  test("lists the customer's quote requests", async () => {
    await renderPage([
      { id: "q1", reference: "COT-001", message: "Necesito fusionadoras", status: "pending" },
    ]);

    expect(screen.getByText("COT-001")).toBeInTheDocument();
    expect(screen.getByText("Necesito fusionadoras")).toBeInTheDocument();
  });

  test("explains the empty state instead of showing a bare list", async () => {
    await renderPage([]);

    expect(screen.getByText(/aún no tienes cotizaciones/i)).toBeInTheDocument();
  });
});
