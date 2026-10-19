import type { MetadataRoute } from "next";

import { publicSiteUrl } from "@/lib/site-url";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await publicSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/cuenta", "/api", "/login", "/registro"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
