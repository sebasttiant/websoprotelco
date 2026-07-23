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
    await expect(primaryNavigation.getByRole("link", { name: "Productos" })).toBeVisible();
  }

  async expectCompactNavigation(): Promise<void> {
    const menuButton = this.page.getByRole("button", { name: "Abrir menú" });

    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(this.page.getByRole("button", { name: "Cerrar menú" })).toHaveAttribute("aria-expanded", "true");

    const mobileNavigation = this.page.getByRole("navigation", { name: "Navegación móvil" });
    await expect(mobileNavigation.getByRole("link", { name: "Productos" })).toBeVisible();
  }
}
