import { expect, test } from "@playwright/test";

test.describe("Catalog PostgreSQL smoke", () => {
  test("browses categories, preserves fallbacks, and exposes quote entry", { tag: ["@critical", "@e2e", "@catalog", "@CATALOG-E2E-001"] }, async ({ page }) => {
    const remoteImageRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("supabase.co")) remoteImageRequests.push(request.url());
    });

    await page.goto("/productos");
    await expect(page.getByRole("heading", { name: "Nuestros Productos" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Cotizar" }).first()).toHaveAttribute("href", "/contacto?producto=fusionadora-segura");
    await expect(page.getByRole("navigation", { name: "Ruta de navegación" })).toBeVisible();
    await expect(page.getByText("Sin imagen").first()).toBeVisible();
    await expect(page.getByRole("img", { name: "Imagen no segura" })).toHaveCount(0);
    expect(remoteImageRequests).toEqual([]);

    await page.goto("/productos/fibra");
    await expect(page.getByRole("heading", { name: "Fibra óptica" })).toBeVisible();
    await page.goto("/productos/sin-productos");
    await expect(page.getByRole("heading", { name: "No encontramos productos" })).toBeVisible();

    await page.goto("/producto/desconocido");
    await expect(page.getByRole("heading", { name: "No encontramos este producto" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver al catálogo" })).toBeVisible();
  });
});
