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
    await menuButton.click();
    await expect(this.page.getByRole("button", { name: "Cerrar menú" })).toHaveAttribute("aria-expanded", "true");

    // `exact` matters here: the mobile menu lists categories alongside the top-level links, and
    // an accessible-name match is a substring by default, so a category named "Sin productos"
    // also satisfies "Productos" and the locator resolves to two elements.
    const mobileNavigation = this.page.getByRole("navigation", { name: "Navegación móvil" });
    await expect(mobileNavigation.getByRole("link", { name: "Productos", exact: true })).toBeVisible();
  }
}
