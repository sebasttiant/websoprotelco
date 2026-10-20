import {
  getEffectivePriceCents,
  getSafeCatalogImageUrl,
  type ProductDetail,
} from "@/domains/catalog/schemas";

/**
 * schema.org Product markup for the detail page, so search engines can show the
 * price and availability next to the result instead of a bare link. Prices follow
 * the same rule as the storefront: the promotional price is the real price while
 * one is set (see getEffectivePriceCents).
 */
export function buildProductJsonLd(product: ProductDetail, siteUrl: string) {
  const base = siteUrl.replace(/\/$/, "");
  const imageUrl = getSafeCatalogImageUrl(product.imageUrl);
  const brand = product.brand.trim();

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description.trim() || `${product.name} de ${product.categoryName}.`,
    sku: product.sku,
    category: product.categoryName,
    ...(brand ? { brand: { "@type": "Brand", name: brand } } : {}),
    ...(imageUrl ? { image: [`${base}${imageUrl}`] } : {}),
    offers: {
      "@type": "Offer",
      url: `${base}/producto/${product.slug}`,
      priceCurrency: product.currency,
      price: getEffectivePriceCents(product) / 100,
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}
