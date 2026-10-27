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
      await expect(page.getByRole("status")).toContainText(
        "Tu mensaje se registra en el buzón de SOPROTELCO con un formato claro y estructurado",
      );
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

      // Capture the deep link without opening a real tab or waiting on WhatsApp's CDN —
      // every CI second burned on wa.me is a flaky third-party dependency.
      await page.evaluate(() => {
        window.open = ((url?: string | URL) => {
          (window as unknown as { __soprotelcoOpenedUrl?: string }).__soprotelcoOpenedUrl = String(url ?? "");
          return null;
        }) as typeof window.open;
      });
      await page.getByRole("button", { name: "Enviar y abrir WhatsApp" }).click();
      const openedUrl = await page.evaluate(
        () => (window as unknown as { __soprotelcoOpenedUrl?: string }).__soprotelcoOpenedUrl ?? "",
      );
      expect(openedUrl).toContain("https://wa.me/573001234567");
      expect(openedUrl).toContain(encodeURIComponent("Ada Privada"));
      expect(openedUrl).toContain(encodeURIComponent("Mensaje privado de prueba"));

      await expect(page).toHaveURL(contactUrl);
      expect(page.url()).not.toContain("ada.privada@example.test");
      expect(page.url()).not.toContain("Mensaje privado de prueba");
      await expect(page.getByRole("status")).toContainText(
        "Tu mensaje se registra en el buzón de SOPROTELCO con un formato claro y estructurado",
      );

      await page.getByRole("link", { name: "Política de privacidad" }).click();
      await expect(page.getByRole("heading", { name: "Política de privacidad" })).toBeVisible();
      await expect(page.getByText("Ley 1581 de 2012")).toBeVisible();

      await page.goto("/cuenta");
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    },
  );
});
