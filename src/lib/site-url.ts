import { headers } from "next/headers";

// Prefer the public origin configured for this deploy. When the domain is pointed at this
// app, set NEXT_PUBLIC_SITE_URL to https://soprotelco.com so canonicals and the sitemap
// follow the domain instead of the temporary address.
export async function publicSiteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;

  try {
    const headerList = await headers();
    const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
    if (host) {
      const proto = headerList.get("x-forwarded-proto") ?? "http";
      return `${proto}://${host}`;
    }
  } catch {
    // Called outside a request. The sitemap still needs an absolute origin.
  }

  return "http://127.0.0.1:8686";
}
