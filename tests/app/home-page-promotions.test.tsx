import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

const getFeaturedProducts = vi.hoisted(() => vi.fn());
const getPromotedProducts = vi.hoisted(() => vi.fn());
const getCategories = vi.hoisted(() => vi.fn());
const getSiteSettings = vi.hoisted(() => vi.fn());
const publicSiteUrl = vi.hoisted(() => vi.fn());

vi.mock("@/domains/catalog", () => ({
  getFeaturedProducts,
  getPromotedProducts,
  getCategories,
}));
vi.mock("@/domains/settings", () => ({ getSiteSettings }));
vi.mock("@/lib/site-url", () => ({ publicSiteUrl }));
vi.mock("@/components/home/hero", () => ({ Hero: () => <div>Hero</div> }));
vi.mock("@/components/home/trust-strip", () => ({ TrustStrip: () => <div>Trust</div> }));
vi.mock("@/components/home/fiber-flow-panel", () => ({ FiberFlowPanel: () => <div>Flow</div> }));
vi.mock("@/components/home/category-strip", () => ({
  CategoryStrip: () => <div>Categories</div>,
}));
vi.mock("@/components/home/featured-products", () => ({
  FeaturedProducts: () => <div>Featured</div>,
}));
vi.mock("@/components/home/promo-products", () => ({
  PromoProducts: ({ products }: { products: unknown[] }) => (
    <div data-testid="promos">promos:{products.length}</div>
  ),
}));
vi.mock("@/components/home/support", () => ({ Support: () => <div>Support</div> }));
vi.mock("@/components/layout/header", () => ({ Header: () => <div>Header</div> }));
vi.mock("@/components/layout/footer", () => ({ Footer: () => <div>Footer</div> }));

import HomePage from "@/app/page";

describe("HomePage promotion isolation", () => {
  test("still renders when promoted products query rejects", async () => {
    getFeaturedProducts.mockResolvedValue([]);
    getPromotedProducts.mockRejectedValue(new Error("db down"));
    getCategories.mockResolvedValue([]);
    getSiteSettings.mockResolvedValue({
      siteName: "SOPROTELCO",
      siteDescription: "Fiber",
      contactEmail: "a@b.co",
      contactPhone: "300",
      address: "Medellín",
      whatsappNumber: "",
    });
    publicSiteUrl.mockResolvedValue("http://127.0.0.1:8686");

    const page = await HomePage();
    render(page);

    expect(screen.getByText("Hero")).toBeInTheDocument();
    expect(screen.getByTestId("promos")).toHaveTextContent("promos:0");
  });
});
