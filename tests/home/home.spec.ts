import { test } from "@playwright/test";

import { HomePage } from "./home-page";

test.describe("Home smoke", () => {
  test("loads the foundation page", { tag: ["@critical", "@e2e", "@home", "@HOME-E2E-001"] }, async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goto();
    await homePage.expectLoaded();
    await homePage.expectTitle(/SOPROTELCO/);
  });
});
