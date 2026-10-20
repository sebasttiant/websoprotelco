import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.stubGlobal(
  "matchMedia",
  vi.fn().mockImplementation(() => ({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  })),
);
vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

import { PromoProducts } from "@/components/home/promo-products";
import type { ProductSummary } from "@/domains/catalog";

const promoProduct: ProductSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "fusionadora-x",
  sku: "FUS-001",
  name: "Fusionadora X",
  description: "Empalmes de fibra en campo.",
  priceCents: 1_000_000,
  promoPriceCents: 750_000,
  isFeatured: true,
  currency: "COP",
  categoryName: "Fusionadoras",
  categorySlug: "fusionadoras",
  brand: "SP",
  imageUrl: null,
  inStock: true,
};

describe("PromoProducts", () => {
  test("renders the promotions section with discount and add-to-cart", () => {
    render(<PromoProducts products={[promoProduct]} />);

    expect(screen.getByRole("heading", { name: "Promociones y destacados" })).toBeInTheDocument();
    expect(screen.getByText("-25%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /agregar fusionadora x al carrito/i })).toBeInTheDocument();
  });

  test("renders nothing when there are no promoted products", () => {
    const { container } = render(<PromoProducts products={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
