import { expect, test, type Page } from "@playwright/test";

import { getE2eAdminCredentials, seedE2eAdmin } from "../helpers/e2e-admin";

const ADMIN_EMAIL = "e2e-admin@tests.invalid";
const ADMIN_PASSWORD = "e2e-only-password";

// Real handsets that bracket the range: 320 is the narrowest phone still in use, 430 the widest
// before tablets. All three must be below Tailwind's `md:` (768px), which is the breakpoint the
// drawer's matchMedia subscription and the `hidden md:flex` classes are both keyed to.
const COMPACT_WIDTHS = [320, 375, 430] as const;
const DESKTOP_WIDTH = 768;

// The accessible name is asserted with `exact` throughout. Playwright's default is a
// case-insensitive SUBSTRING match, so a bare "Secciones de administración" also matches the
// drawer's "Secciones de administración móvil" — which would make the desktop-nav assertions
// ambiguous the moment the drawer is open, and able to pass against the wrong element.
const DESKTOP_NAV = { name: "Secciones de administración", exact: true } as const;

test.beforeAll(async () => {
  // Refuses any database whose name does not end in `_test` before opening a connection.
  await seedE2eAdmin(
    getE2eAdminCredentials({
      DATABASE_URL: process.env.DATABASE_URL,
      E2E_ADMIN_EMAIL: ADMIN_EMAIL,
      E2E_ADMIN_PASSWORD: ADMIN_PASSWORD,
    }),
  );
});

/**
 * Signs in through the real login form, and proves the context started unauthenticated.
 *
 * Every `test` gets a fresh browser context, so cookies never carry across. The visible-form
 * check enforces that: a reused session would redirect straight off `/login` to `/admin`, the
 * form would never render, and the assertions after it would run against an already-authenticated
 * page — passing without this test ever having exercised a login.
 */
async function signInAsAdmin(page: Page) {
  await page.goto("/login");

  const email = page.getByLabel("Correo");
  await expect(email).toBeVisible();

  await email.fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

// jsdom applies no Tailwind, so the unit tests cannot see `hidden md:flex` at all — reverting it
// leaves them entirely green. Only a real browser at a real width can hold that contract, and it
// is the contract that matters most: get it wrong and a phone has no admin navigation.
for (const width of COMPACT_WIDTHS) {
  test.describe(`Admin sidebar at ${width}px`, () => {
    test.use({ viewport: { width, height: 812 } });

    test(
      "hides the desktop navigation and offers the sections through the drawer",
      { tag: ["@high", "@e2e", "@admin", "@ADMIN-E2E-001"] },
      async ({ page }) => {
        await signInAsAdmin(page);

        await expect(page.getByRole("navigation", DESKTOP_NAV)).toBeHidden();

        const trigger = page.getByRole("button", { name: "Abrir menú" });
        await expect(trigger).toBeVisible();
        await trigger.click();

        const drawer = page.getByRole("dialog", { name: "Menú de administración" });
        await expect(drawer).toBeVisible();
        await expect(page.getByRole("button", { name: "Cerrar menú", exact: true })).toBeFocused();

        await page.getByRole("button", { name: "Cerrar menú", exact: true }).click();
        await expect(drawer).toBeHidden();
        await expect(trigger).toBeFocused();
      },
    );

    test(
      "navigates from the drawer and closes it on the way",
      { tag: ["@high", "@e2e", "@admin", "@ADMIN-E2E-002"] },
      async ({ page }) => {
        await signInAsAdmin(page);

        await page.getByRole("button", { name: "Abrir menú" }).click();
        const drawer = page.getByRole("dialog", { name: "Menú de administración" });
        await drawer.getByRole("link", { name: "Productos" }).click();

        await expect(page).toHaveURL(/\/admin\/products$/);
        await expect(drawer).toBeHidden();
        // Still compact after the route change: the drawer must not leave the desktop navigation
        // exposed behind it.
        await expect(page.getByRole("navigation", DESKTOP_NAV)).toBeHidden();
      },
    );

    test(
      "dismisses the drawer with Escape",
      { tag: ["@high", "@e2e", "@admin", "@ADMIN-E2E-003"] },
      async ({ page }) => {
        await signInAsAdmin(page);

        await page.getByRole("button", { name: "Abrir menú" }).click();
        const drawer = page.getByRole("dialog", { name: "Menú de administración" });
        await expect(drawer).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(drawer).toBeHidden();
        await expect(page.getByRole("button", { name: "Abrir menú" })).toBeFocused();
      },
    );
  });
}

// 768px is the first width at which `md:` applies, so this is the boundary itself rather than a
// comfortable desktop size: an off-by-one in the breakpoint shows up here and nowhere else.
test.describe(`Admin sidebar at ${DESKTOP_WIDTH}px`, () => {
  test.use({ viewport: { width: DESKTOP_WIDTH, height: 900 } });

  test(
    "shows the desktop navigation and withdraws the drawer trigger",
    { tag: ["@high", "@e2e", "@admin", "@ADMIN-E2E-004"] },
    async ({ page }) => {
      await signInAsAdmin(page);

      await expect(page.getByRole("navigation", DESKTOP_NAV)).toBeVisible();
      await expect(page.getByRole("button", { name: "Abrir menú" })).toBeHidden();
      await expect(page.getByRole("link", { name: "Panel de control" })).toBeVisible();
    },
  );
});
