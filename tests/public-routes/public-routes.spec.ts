import { expect, test } from "@playwright/test";

test.describe("Public route smoke", () => {
  test(
    "keeps contact, legal navigation, and account entry accessible",
    { tag: ["@high", "@e2e", "@public-routes", "@PUBLIC-ROUTES-E2E-001"] },
    async ({ page }) => {
      await page.goto("/contacto?producto=fusionadora-segura");

      await expect(page.getByRole("heading", { name: "Contáctanos" })).toBeVisible();
      await expect(page.getByLabel("Nombre Completo")).toHaveAttribute("required", "");
      await expect(page.getByLabel("Correo Electrónico")).toHaveAttribute("type", "email");
      await expect(page.getByRole("status")).toContainText("El envío en línea todavía no está disponible");
      await expect(page.getByText("Producto consultado: fusionadora-segura")).toBeVisible();
      await expect(page.getByRole("link", { name: "Contactar por WhatsApp" })).toHaveAttribute(
        "href",
        "https://wa.me/573001234567",
      );

      await page.getByLabel("Nombre Completo").fill("Ada Privada");
      await page.getByLabel("Correo Electrónico").fill("ada.privada@example.test");
      await page.getByLabel("WhatsApp / Teléfono").fill("+57 300 555 0101");
      await page.getByLabel("Tu mensaje").fill("Mensaje privado de prueba");

      const contactUrl = page.url();
      const requestsAfterPreparation: string[] = [];
      page.on("request", (request) => requestsAfterPreparation.push(request.url()));

      await page.getByRole("button", { name: "Preparar mensaje" }).click();

      await expect(page).toHaveURL(contactUrl);
      expect(page.url()).not.toContain("ada.privada@example.test");
      expect(page.url()).not.toContain("Mensaje privado de prueba");
      expect(requestsAfterPreparation).toEqual([]);
      await expect(page.getByRole("status")).toContainText("El envío en línea todavía no está disponible");

      await page.getByRole("link", { name: "Política de privacidad" }).click();
      await expect(page.getByRole("heading", { name: "Política de privacidad" })).toBeVisible();
      await expect(page.getByText("Ley 1581 de 2012")).toBeVisible();

      await page.goto("/cuenta");
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    },
  );
});
