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
    await expect(this.heading("Ecommerce rebuild foundation")).toBeVisible();
  }
}
