/**
 * Turns a human product/category name into a URL-safe slug.
 * Spanish accents are folded so "Fusionadora Pro" → "fusionadora-pro".
 */
export function slugifyName(name: string, maxLength = 120): string {
  const slug = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");

  return slug || "item";
}
