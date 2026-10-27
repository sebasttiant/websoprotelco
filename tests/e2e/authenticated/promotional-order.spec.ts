import { expect, test } from "@playwright/test";
import { Client } from "pg";

import { environment } from "./support";

const PRODUCT_NAME = "Fusionadora E2E";
const PROMO_UNIT_CENTS = 1_200_000;
const LIST_UNIT_CENTS = 1_500_000;
const ORDER_QTY = 2;
const EXPECTED_TOTAL_CENTS = PROMO_UNIT_CENTS * ORDER_QTY;

test.describe("Promotional storefront order", () => {
  test(
    "renders the promo price and persists the promotional total when the order completes",
    { tag: ["@critical", "@e2e", "@auth", "@PROMO-E2E-001"] },
    async ({ page }) => {
      await page.goto("/producto/e2e-fusionadora");
      await expect(page.getByRole("heading", { name: PRODUCT_NAME })).toBeVisible();
      await expect(page.getByText("-20%")).toBeVisible();
      await expect(page.getByText("$ 12.000")).toBeVisible();
      await expect(page.getByText("$ 15.000")).toBeVisible();

      await page.getByRole("button", { name: `Agregar ${PRODUCT_NAME} al carrito` }).click();
      await expect(page.getByText(`${PRODUCT_NAME} se agregó al carrito.`)).toBeAttached();

      await page.goto("/carrito");
      // /carrito is full-page checkout: contact fields are already on the page (no drawer step).
      const quantity = page.locator("main").getByLabel(new RegExp(`Cantidad para ${PRODUCT_NAME}`));
      await expect(quantity).toBeVisible();
      await quantity.fill(String(ORDER_QTY));
      await expect(page.locator("main").getByText("$ 24.000")).toBeVisible();

      await page.getByLabel("Nombre").fill("Cliente Promo E2E");
      await page.getByLabel("Correo").fill("promo.e2e@example.test");
      await page.getByLabel("Teléfono").fill("3005550199");
      await page.getByRole("button", { name: "Enviar pedido por formulario" }).click();

      await expect(page.getByRole("heading", { name: "Pedido recibido" })).toBeVisible();
      // createReference(): WEB-<base36 timestamp>-<8 hex chars>
      const confirmation = await page.locator("main").getByText(/Tu referencia es/).textContent();
      const reference = confirmation?.match(/WEB-[A-Z0-9]+-[A-F0-9]{8}/)?.[0];
      expect(reference).toBeTruthy();

      const client = new Client({ connectionString: environment.databaseUrl });
      await client.connect();
      try {
        const order = await client.query<{ id: string; kind: string }>(
          "SELECT id, kind FROM quote_requests WHERE reference = $1",
          [reference],
        );
        expect(order.rows).toHaveLength(1);
        expect(order.rows[0]?.kind).toBe("order");

        const lines = await client.query<{
          quantity: number;
          unit_price_cents: string;
          product_name: string;
        }>("SELECT quantity, unit_price_cents, product_name FROM quote_request_items WHERE quote_request_id = $1", [
          order.rows[0]!.id,
        ]);

        expect(lines.rows).toHaveLength(1);
        expect(lines.rows[0]).toMatchObject({
          quantity: ORDER_QTY,
          product_name: PRODUCT_NAME,
        });
        expect(Number(lines.rows[0]!.unit_price_cents)).toBe(PROMO_UNIT_CENTS);
        expect(Number(lines.rows[0]!.unit_price_cents)).not.toBe(LIST_UNIT_CENTS);
        expect(Number(lines.rows[0]!.unit_price_cents) * ORDER_QTY).toBe(EXPECTED_TOTAL_CENTS);
      } finally {
        await client.end();
      }
    },
  );
});
