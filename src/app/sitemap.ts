import type { MetadataRoute } from "next";

import { getCategories, listPublicProductPaths } from "@/domains/catalog";
import { publicSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await publicSiteUrl();
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = ["", "/productos", "/contacto", "/terminos", "/privacidad"].map((path) => ({
    url: `${base}${path || "/"}`,
    lastModified: now,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));

  try {
    const [products, categories] = await Promise.all([listPublicProductPaths(), getCategories()]);
    return [
      ...staticRoutes,
      ...categories.map((category) => ({
        url: `${base}/productos/${category.slug}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
      ...products.map((product) => ({
        url: `${base}/producto/${product.slug}`,
        lastModified: new Date(product.updatedAt),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
