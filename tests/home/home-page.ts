import { expect, type Page } from "@playwright/test";

import { BasePage } from "../base-page";

export class HomePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await super.goto("/");
  }

  async expectLoaded(): Promise<void> {
    const primaryNavigation = this.page.getByRole("navigation", { name: "Navegación principal" });

    await expect(primaryNavigation).toBeVisible();
    // Exact for the same reason as the mobile assertion below: the products dropdown puts
    // category links in this nav, and one of them can contain the word on its own.
    await expect(primaryNavigation.getByRole("link", { name: "Productos", exact: true })).toBeVisible();
  }

  async expectCompactNavigation(): Promise<void> {
    const menuButton = this.page.getByRole("button", { name: "Abrir menú" });

    await expect(menuButton).toBeVisible();

    // Retried rather than clicked once. Playwright waits for the element to be actionable, but
    // "actionable" only means rendered and hittable — a button painted by the server is all of
    // those before React has hydrated and attached its handler, so an early click lands on
    // nothing. Under parallel workers the dev server is slow enough for that to happen
    // intermittently, which is how this suite acquired a flake that passed on every rerun.
    await expect(async () => {
      await menuButton.click();
      await expect(this.page.getByRole("button", { name: "Cerrar menú" })).toHaveAttribute(
        "aria-expanded",
        "true",
        { timeout: 1_000 },
      );
    }).toPass({ timeout: 15_000 });

    // `exact` matters here: the mobile menu lists categories alongside the top-level links, and
    // an accessible-name match is a substring by default, so a category named "Sin productos"
    // also satisfies "Productos" and the locator resolves to two elements.
    const mobileNavigation = this.page.getByRole("navigation", { name: "Navegación móvil" });
    await expect(mobileNavigation.getByRole("link", { name: "Productos", exact: true })).toBeVisible();
  }
}
