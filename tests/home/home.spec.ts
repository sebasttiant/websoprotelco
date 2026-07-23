import { test } from "@playwright/test";

import { HomePage } from "./home-page";

test.describe("Home smoke", () => {
  test("loads the public SOPROTELCO shell", { tag: ["@critical", "@e2e", "@home", "@HOME-E2E-001"] }, async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goto();
    await homePage.expectLoaded();
    await homePage.expectTitle(/SOPROTELCO/);
  });

  test("keeps primary navigation operable on a compact viewport", { tag: ["@high", "@e2e", "@home", "@HOME-E2E-002"] }, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    const homePage = new HomePage(page);
    await homePage.goto();
    await homePage.expectCompactNavigation();
  });
});
