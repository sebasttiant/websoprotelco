import { describe, expect, test } from "vitest";

import { isSafeCatalogImagePath } from "@/domains/catalog";
// Input schemas are internal to the domain; the test exercises them white-box.
import { categoryAdminInputSchema, productAdminInputSchema } from "@/domains/catalog/schemas";

// A real upload produces exactly this shape via the local storage adapter.
const SAFE = "/uploads/2026-03-08-3f2504e0-4f89-41d3-9a0c-0305e82c3301.webp";

describe("isSafeCatalogImagePath", () => {
  test("accepts an adapter-generated local path", () => {
    expect(isSafeCatalogImagePath(SAFE)).toBe(true);
    expect(isSafeCatalogImagePath("/uploads/2026-01-01-3f2504e0-4f89-41d3-9a0c-0305e82c3301.jpg")).toBe(true);
  });

  test("rejects remote URLs, data URIs, traversal and junk", () => {
    expect(isSafeCatalogImagePath("https://evil.example.com/x.png")).toBe(false);
    expect(isSafeCatalogImagePath("http://localhost/uploads/x.png")).toBe(false);
    expect(isSafeCatalogImagePath("data:image/png;base64,AAAA")).toBe(false);
    expect(isSafeCatalogImagePath("/uploads/../../etc/passwd")).toBe(false);
    expect(isSafeCatalogImagePath("/uploads/anything.svg")).toBe(false);
    expect(isSafeCatalogImagePath("")).toBe(false);
  });
});

describe("catalog admin schemas validate imageUrl (no silent data loss)", () => {
  const baseProduct = {
    categoryId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    sku: "SKU-1",
    slug: "slug-1",
    name: "Producto",
    priceCents: "1000",
    currency: "cop",
    stockQuantity: "0",
    brand: "",
  };

  test("keeps a safe path", () => {
    const parsed = productAdminInputSchema.parse({ ...baseProduct, imageUrl: SAFE });
    expect(parsed.imageUrl).toBe(SAFE);
  });

  test("treats blank as an intentional removal (null), never erroring", () => {
    const parsed = productAdminInputSchema.parse({ ...baseProduct, imageUrl: "" });
    expect(parsed.imageUrl).toBeNull();
  });

  test("rejects a remote URL with a Spanish error instead of silently nulling it", () => {
    const result = productAdminInputSchema.safeParse({ ...baseProduct, imageUrl: "https://evil.example.com/x.png" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const imageIssue = result.error.issues.find((issue) => issue.path.includes("imageUrl"));
      expect(imageIssue?.message).toBe(
        "La URL de la imagen no es válida. Subí una imagen o dejá el campo en blanco para quitarla.",
      );
    }
  });

  test("rejects a base64 data URI instead of silently nulling it", () => {
    const result = productAdminInputSchema.safeParse({ ...baseProduct, imageUrl: "data:image/png;base64,AAAA" });
    expect(result.success).toBe(false);
  });

  test("rejects a javascript: URI instead of silently nulling it", () => {
    const result = productAdminInputSchema.safeParse({ ...baseProduct, imageUrl: "javascript:alert(1)" });
    expect(result.success).toBe(false);
  });

  test("rejects a legacy unsafe path instead of silently nulling it", () => {
    const result = productAdminInputSchema.safeParse({ ...baseProduct, imageUrl: "/uploads/anything.svg" });
    expect(result.success).toBe(false);
  });

  test("category schema rejects an unsafe value the same way", () => {
    const result = categoryAdminInputSchema.safeParse({
      parentId: "",
      slug: "cat",
      name: "Categoría",
      displayOrder: "0",
      imageUrl: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const imageIssue = result.error.issues.find((issue) => issue.path.includes("imageUrl"));
      expect(imageIssue?.message).toBe(
        "La URL de la imagen no es válida. Subí una imagen o dejá el campo en blanco para quitarla.",
      );
    }
  });

  test("category schema still treats blank as an intentional removal", () => {
    const parsed = categoryAdminInputSchema.parse({
      parentId: "",
      slug: "cat",
      name: "Categoría",
      displayOrder: "0",
      imageUrl: "",
    });
    expect(parsed.imageUrl).toBeNull();
  });
});
