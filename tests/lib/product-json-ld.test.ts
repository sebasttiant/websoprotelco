import { describe, expect, test } from "vitest";

import type { ProductDetail } from "@/domains/catalog/schemas";
import { buildProductJsonLd } from "@/lib/product-json-ld";

const PRODUCT: ProductDetail = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "fusionadora-segura",
  sku: "FUS-01",
  name: "Fusionadora segura",
  description: "Fusionadora de alineación por núcleo.",
  priceCents: 2_500_000_00,
  promoPriceCents: 2_000_000_00,
  isFeatured: true,
  currency: "COP",
  categoryName: "Fusionadoras",
  categorySlug: "fusionadoras",
  brand: "Fujikura",
  imageUrl: "/uploads/2026-01-01-00000000-0000-4000-8000-000000000001.jpg",
  inStock: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("buildProductJsonLd", () => {
  test("offers the effective (promotional) price, not the list price", () => {
    const jsonLd = buildProductJsonLd(PRODUCT, "https://soprotelco.com");

    expect(jsonLd["@type"]).toBe("Product");
    expect(jsonLd.offers.price).toBe(2_000_000);
    expect(jsonLd.offers.priceCurrency).toBe("COP");
    expect(jsonLd.offers.availability).toBe("https://schema.org/InStock");
    expect(jsonLd.offers.url).toBe("https://soprotelco.com/producto/fusionadora-segura");
  });

  test("maps out-of-stock products to OutOfStock and keeps brand and sku", () => {
    const jsonLd = buildProductJsonLd({ ...PRODUCT, inStock: false }, "https://soprotelco.com");

    expect(jsonLd.offers.availability).toBe("https://schema.org/OutOfStock");
    expect(jsonLd.brand).toEqual({ "@type": "Brand", name: "Fujikura" });
    expect(jsonLd.sku).toBe("FUS-01");
  });

  test("absolutizes the image and omits it when the product has none", () => {
    const withImage = buildProductJsonLd(PRODUCT, "https://soprotelco.com");
    expect(withImage.image).toEqual([
      "https://soprotelco.com/uploads/2026-01-01-00000000-0000-4000-8000-000000000001.jpg",
    ]);

    const withoutImage = buildProductJsonLd(
      { ...PRODUCT, imageUrl: null },
      "https://soprotelco.com",
    );
    expect("image" in withoutImage).toBe(false);
  });
});
