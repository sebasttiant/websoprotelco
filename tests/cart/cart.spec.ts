import { expect, test } from "@playwright/test";

test.describe("Cart quote preparation", () => {
  test("collects, updates, and removes catalog products without a payment flow", { tag: ["@critical", "@e2e", "@cart", "@CART-E2E-001"] }, async ({ page }) => {
    await page.goto("/productos");
    await page.getByRole("button", { name: "Agregar" }).first().click();
    await expect(page.getByText("Fusionadora segura se agregó al carrito.")).toBeAttached();

    await page.getByRole("link", { name: "Carrito" }).first().click();
    await expect(page.getByRole("heading", { name: "Tu carrito" })).toBeVisible();
    const quantity = page.getByLabel(/Cantidad para Fusionadora segura/);
    await quantity.fill("2");
    await expect(page.getByText("Cantidad actualizada.")).toBeVisible();
    await expect(page.getByText("Aún no envía una solicitud ni realiza pagos.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Eliminar" })).toBeVisible();
    await page.getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByRole("heading", { name: "Tu carrito está vacío" })).toBeVisible();
  });

  // The cart is a browser-local quote draft: it must never write to the server, because no
  // quote/checkout persistence exists yet. Asserting on methods and /api/ traffic proves the
  // boundary directly instead of trusting that no fetch was written.
  test("performs add, update, and remove without any server write", { tag: ["@critical", "@e2e", "@cart", "@CART-E2E-003"] }, async ({ page }) => {
    const mutatingRequests: string[] = [];
    const apiRequests: string[] = [];

    page.on("request", (request) => {
      const method = request.method().toUpperCase();
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        mutatingRequests.push(`${method} ${request.url()}`);
      }
      if (new URL(request.url()).pathname.startsWith("/api/")) {
        apiRequests.push(`${method} ${request.url()}`);
      }
    });

    await page.goto("/productos");
    await page.getByRole("button", { name: "Agregar" }).first().click();
    await expect(page.getByText("Fusionadora segura se agregó al carrito.")).toBeAttached();

    await page.goto("/carrito");
    const quantity = page.getByLabel(/Cantidad para Fusionadora segura/);
    await quantity.fill("3");
    await expect(page.getByText("Cantidad actualizada.")).toBeVisible();

    await page.getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByRole("heading", { name: "Tu carrito está vacío" })).toBeVisible();

    expect(mutatingRequests).toEqual([]);
    expect(apiRequests).toEqual([]);
  });

  test("recovers from a hostile cached currency without fake totals or a formatting crash", { tag: ["@critical", "@e2e", "@cart", "@CART-E2E-002"] }, async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("soprotelco_quote_cart", JSON.stringify([{
        id: "00000000-0000-4000-8000-000000000001",
        slug: "fusionadora-segura",
        name: "Fusionadora segura",
        priceCents: 1500000,
        currency: "NOT_A_CURRENCY",
        quantity: 1,
      }]));
    });

    await page.goto("/carrito");

    await expect(page.getByRole("heading", { name: "Tu carrito está vacío" })).toBeVisible();
    await expect(page.getByText("Total estimado:")).not.toBeVisible();
  });
});
