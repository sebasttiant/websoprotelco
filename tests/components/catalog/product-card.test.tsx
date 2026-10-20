import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ProductCard } from "@/components/catalog/product-card";
import type { ProductSummary } from "@/domains/catalog";

const baseProduct: ProductSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "fusionadora-x",
  sku: "FUS-001",
  name: "Fusionadora X",
  description: "Empalmes de fibra en campo.",
  priceCents: 100_000_000,
  promoPriceCents: null,
  isFeatured: false,
  currency: "COP",
  categoryName: "Fusionadoras",
  categorySlug: "fusionadoras",
  brand: "SP",
  imageUrl: null,
  inStock: true,
};

describe("ProductCard promotions", () => {
  test("shows the discount badge, promo price and struck-through list price on promotion", () => {
    render(<ProductCard product={{ ...baseProduct, promoPriceCents: 75_000_000 }} />);

    expect(screen.getByText("-25%")).toBeInTheDocument();
    expect(screen.getByText("$ 750.000")).toBeInTheDocument();
    const listPrice = screen.getByText("$ 1.000.000");
    expect(listPrice.tagName.toLowerCase()).toBe("s");
  });

  test("shows the TOP badge when the product is featured", () => {
    render(<ProductCard product={{ ...baseProduct, isFeatured: true }} />);
    expect(screen.getByText("Top")).toBeInTheDocument();
  });

  test("shows no promo or top badges for a regular product", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.queryByText("Top")).not.toBeInTheDocument();
    expect(screen.queryByText(/-%/)).not.toBeInTheDocument();
    expect(screen.getByText("$ 1.000.000")).toBeInTheDocument();
  });
});
