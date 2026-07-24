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

  // The dashboard mock returns the same array for both getQuotes calls (quotes and orders), so
  // these order-shaped rows stand in for the order list the recent-orders panel reads.
  const orderRows = [
    { id: "o1", reference: "WEB-AAA", contactName: "Pedro Páramo", status: "won", totalCents: 529700000, createdAt: "2026-03-06T10:00:00Z" },
    { id: "o2", reference: "WEB-BBB", contactName: "Emilio Contreras", status: "in_review", totalCents: 73800000, createdAt: "2026-03-07T10:00:00Z" },
  ];

  test("lists recent orders by reference, client and status", async () => {
    await renderDashboard({ quotes: orderRows });

    const panel = screen.getByRole("region", { name: /pedidos recientes/i });
    expect(within(panel).getByText("WEB-AAA")).toBeInTheDocument();
    expect(within(panel).getByText("Pedro Páramo")).toBeInTheDocument();
    // "won" renders through the quote label helper as the feminine "Ganada".
    expect(within(panel).getByText(/ganada/i)).toBeInTheDocument();
  });

  test("shows an empty state in the recent-orders panel when there are none", async () => {
    await renderDashboard();

    const panel = screen.getByRole("region", { name: /pedidos recientes/i });
    expect(within(panel).getByText(/aún no hay pedidos/i)).toBeInTheDocument();
  });

  test("lists low-stock products in the alerts panel", async () => {
    await renderDashboard({ lowStock: [{ productId: "p1", name: "Fusionadora V7", currentStock: 2 }] });

    const panel = screen.getByRole("region", { name: /alertas de stock/i });
    expect(within(panel).getByText("Fusionadora V7")).toBeInTheDocument();
    expect(within(panel).getByText(/2 uds/i)).toBeInTheDocument();
  });

  test("reassures when no stock is running low", async () => {
    await renderDashboard();

    const panel = screen.getByRole("region", { name: /alertas de stock/i });
    expect(within(panel).getByText(/no hay alertas de stock bajo/i)).toBeInTheDocument();
  });
});
