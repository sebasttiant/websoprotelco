import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockGetCurrentUser, mockGetProductsForAdmin, mockGetQuotes, mockGetLeads, mockGetLowStockProducts } =
  vi.hoisted(() => ({
    mockGetCurrentUser: vi.fn(),
    mockGetProductsForAdmin: vi.fn(),
    mockGetQuotes: vi.fn(),
    mockGetLeads: vi.fn(),
    mockGetLowStockProducts: vi.fn(),
  }));

vi.mock("@/server/auth/guards", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/domains/catalog", () => ({ getProductsForAdmin: mockGetProductsForAdmin }));
vi.mock("@/domains/quote-order", () => ({ getQuotes: mockGetQuotes }));
vi.mock("@/domains/leads", () => ({ getLeads: mockGetLeads }));
vi.mock("@/domains/inventory", () => ({ getLowStockProducts: mockGetLowStockProducts }));

const { default: AdminDashboardPage } = await import("@/app/admin/page");

async function renderDashboard({
  products = { total: 0, rows: [] },
  quotes = [] as unknown[],
  leads = [] as unknown[],
  lowStock = [] as unknown[],
} = {}) {
  mockGetCurrentUser.mockResolvedValue({ id: "u1", email: "ana@empresa.com", role: "admin" });
  mockGetProductsForAdmin.mockResolvedValue(products);
  mockGetQuotes.mockResolvedValue(quotes);
  mockGetLeads.mockResolvedValue(leads);
  mockGetLowStockProducts.mockResolvedValue(lowStock);
  render(await AdminDashboardPage());
}

function statValue(label: RegExp) {
  return within(screen.getByRole("group", { name: label })).getByRole("status").textContent;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("AdminDashboardPage", () => {
  test("counts the products in the catalog", async () => {
    await renderDashboard({ products: { total: 42, rows: [] } });

    expect(statValue(/^productos$/i)).toBe("42");
  });

  test("counts only the quotes still awaiting a reply", async () => {
    // "Awaiting a reply" is received + in_review. Once a quote is quoted, won, lost or
    // cancelled it has been dealt with and must not keep nagging the admin.
    await renderDashboard({
      quotes: [
        { status: "received" },
        { status: "in_review" },
        { status: "quoted" },
        { status: "won" },
        { status: "lost" },
        { status: "cancelled" },
      ],
    });

    expect(statValue(/cotizaciones abiertas/i)).toBe("2");
  });

  test("counts the leads", async () => {
    await renderDashboard({ leads: [{ id: "l1" }, { id: "l2" }, { id: "l3" }] });

    expect(statValue(/clientes potenciales/i)).toBe("3");
  });

  test("counts the products running low on stock", async () => {
    await renderDashboard({ lowStock: [{ id: "p1" }] });

    expect(statValue(/stock bajo/i)).toBe("1");
  });

  test("shows zeros rather than blanks on an empty install", async () => {
    await renderDashboard();

    expect(statValue(/^productos$/i)).toBe("0");
    expect(statValue(/clientes potenciales/i)).toBe("0");
  });

  test("names the signed-in administrator", async () => {
    await renderDashboard();

    expect(screen.getByText(/ana@empresa\.com/)).toBeInTheDocument();
  });
});
