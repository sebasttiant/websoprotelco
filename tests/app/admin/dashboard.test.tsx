import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const {
  mockRequirePermission,
  mockCountAllProducts,
  mockGetQuotes,
  mockGetQuoteDashboardCounts,
  mockCountLeads,
  mockGetLowStockProducts,
} = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockCountAllProducts: vi.fn(),
  mockGetQuotes: vi.fn(),
  mockGetQuoteDashboardCounts: vi.fn(),
  mockCountLeads: vi.fn(),
  mockGetLowStockProducts: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({ requirePermission: mockRequirePermission }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/domains/catalog", () => ({ countAllProducts: mockCountAllProducts }));
vi.mock("@/domains/quote-order", () => ({
  getQuotes: mockGetQuotes,
  getQuoteDashboardCounts: mockGetQuoteDashboardCounts,
}));
vi.mock("@/domains/leads", () => ({ countLeads: mockCountLeads }));
vi.mock("@/domains/inventory", () => ({ getLowStockProducts: mockGetLowStockProducts }));

const { default: AdminDashboardPage } = await import("@/app/admin/page");

async function renderDashboard({
  productCount = 0,
  commercial = {
    totalOrders: 0,
    pendingOrders: 0,
    openQuotes: 0,
    revenueCents: 0,
    wonWithoutTotal: 0,
  },
  leadCount = 0,
  recentOrders = [] as unknown[],
  lowStock = [] as unknown[],
} = {}) {
  mockRequirePermission.mockResolvedValue({ id: "u1", email: "ana@empresa.com", role: "admin" });
  mockCountAllProducts.mockResolvedValue(productCount);
  mockGetQuoteDashboardCounts.mockResolvedValue(commercial);
  mockGetQuotes.mockResolvedValue(recentOrders);
  mockCountLeads.mockResolvedValue(leadCount);
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
  test("authorizes the session before any dashboard data query runs", async () => {
    mockRequirePermission.mockRejectedValue(new Error("NEXT_NOT_FOUND"));

    await expect(AdminDashboardPage()).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockRequirePermission).toHaveBeenCalledWith("quote:read");
    expect(mockCountAllProducts).not.toHaveBeenCalled();
    expect(mockGetQuoteDashboardCounts).not.toHaveBeenCalled();
    expect(mockGetQuotes).not.toHaveBeenCalled();
    expect(mockCountLeads).not.toHaveBeenCalled();
    expect(mockGetLowStockProducts).not.toHaveBeenCalled();
  });

  test("refuses a session that lacks the permission for any section the dashboard reads", async () => {
    // quote:read alone is not enough: the dashboard also reads catalog, leads and inventory.
    mockRequirePermission.mockResolvedValue({ id: "u2", email: "ops@empresa.com", role: "customer" });

    await expect(AdminDashboardPage()).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockCountAllProducts).not.toHaveBeenCalled();
    expect(mockGetQuoteDashboardCounts).not.toHaveBeenCalled();
    expect(mockCountLeads).not.toHaveBeenCalled();
  });

  test("lets staff in, since their role holds every permission the dashboard reads", async () => {
    await renderDashboard({ productCount: 7 });
    cleanup();
    mockRequirePermission.mockResolvedValue({ id: "u3", email: "staff@empresa.com", role: "staff" });

    render(await AdminDashboardPage());

    expect(screen.getByText(/staff@empresa\.com/)).toBeInTheDocument();
  });

  test("counts the products in the catalog", async () => {
    await renderDashboard({ productCount: 42 });

    expect(statValue(/^productos$/i)).toBe("42");
  });

  test("shows open quotes from SQL dashboard counts", async () => {
    await renderDashboard({ commercial: { totalOrders: 0, pendingOrders: 0, openQuotes: 2, revenueCents: 0, wonWithoutTotal: 0 } });

    expect(statValue(/cotizaciones abiertas/i)).toBe("2");
  });

  test("counts the leads", async () => {
    await renderDashboard({ leadCount: 3 });

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

  const orderRows = [
    { id: "o1", reference: "WEB-AAA", contactName: "Pedro Páramo", status: "won", totalCents: 529700000, createdAt: "2026-03-06T10:00:00Z" },
    { id: "o2", reference: "WEB-BBB", contactName: "Emilio Contreras", status: "in_review", totalCents: 73800000, createdAt: "2026-03-07T10:00:00Z" },
  ];

  test("lists recent orders by reference, client and status", async () => {
    await renderDashboard({ recentOrders: orderRows });

    const panel = screen.getByRole("region", { name: /pedidos recientes/i });
    expect(within(panel).getByText("WEB-AAA")).toBeInTheDocument();
    expect(within(panel).getByText("Pedro Páramo")).toBeInTheDocument();
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
