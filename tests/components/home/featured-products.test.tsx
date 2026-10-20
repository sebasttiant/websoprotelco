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

import { FeaturedProducts } from "@/components/home/featured-products";
import type { ProductSummary } from "@/domains/catalog";

const product: ProductSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "fusionadora-x",
  sku: "FUS-001",
  name: "Fusionadora X",
  description: "Empalmes de fibra en campo.",
  priceCents: 1500000,
  currency: "COP",
  categoryName: "Fusionadoras",
  categorySlug: "fusionadoras",
  brand: "SP",
  imageUrl: null,
  inStock: true,
};

describe("FeaturedProducts", () => {
  test("lets shoppers add featured products to the cart without opening the detail", () => {
    render(<FeaturedProducts products={[product]} />);

    expect(screen.getByRole("button", { name: "Agregar" })).toBeInTheDocument();
  });
});
