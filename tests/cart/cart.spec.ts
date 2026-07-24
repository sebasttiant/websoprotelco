import { expect, test } from "@playwright/test";

test.describe("Cart quote preparation", () => {
  test("collects, updates, and removes catalog products without a payment flow", { tag: ["@critical", "@e2e", "@cart", "@CART-E2E-001"] }, async ({ page }) => {
    await page.goto("/productos");
    await page.getByRole("button", { name: "Agregar" }).first().click();
    await expect(page.getByText("Fusionadora segura se agregó al carrito.")).toBeAttached();

    // Navigated to directly rather than by clicking the cart icon: that icon now opens the
    // drawer (covered by CART-E2E-004 below). /carrito remains the no-JavaScript fallback and
    // this test is what keeps it working.
    await page.goto("/carrito");
    // `exact` because "Tu carrito" is a substring of the empty-state heading "Tu carrito está
    // vacío", which renders on the first paint before the cart hydrates from localStorage.
    await expect(page.getByRole("heading", { name: "Tu carrito", exact: true })).toBeVisible();

    // Waiting on the row itself is what proves hydration finished and the product is listed;
    // the page heading above is present either way.
    const quantity = page.getByLabel(/Cantidad para Fusionadora segura/);
    await expect(quantity).toBeVisible();
    await quantity.fill("2");
    await expect(page.getByText("Cantidad actualizada.")).toBeVisible();
    await expect(page.getByText("Aún no envía una solicitud ni realiza pagos.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Eliminar" })).toBeVisible();
    await page.getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByRole("heading", { name: "Tu carrito está vacío" })).toBeVisible();
  });

  // Composing a cart stays entirely browser-local. Confirming an order from the drawer DOES
  // write — that is the whole point of it — but adding, updating and removing must not, so a
  // visitor browsing the catalog never touches the database. Asserting on methods and /api/
  // traffic proves the boundary directly instead of trusting that no fetch was written.
  test("performs add, update, and remove without any server write", { tag: ["@critical", "@e2e", "@cart", "@CART-E2E-003"] }, async ({ page }) => {
    const mutatingRequests: string[] = [];
    const apiRequests: string[] = [];

    page.on("request", (request) => {
      const method = request.method().toUpperCase();
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        mutatingRequests.push(`${method} ${request.url()}`);
      }
      if (new URL(request.url()).pathname.startsWith("/api/")) {
        apiRequests.push(`${method} ${request.url()}`);
      }
    });

    await page.goto("/productos");
    await page.getByRole("button", { name: "Agregar" }).first().click();
    await expect(page.getByText("Fusionadora segura se agregó al carrito.")).toBeAttached();

    await page.goto("/carrito");
    const quantity = page.getByLabel(/Cantidad para Fusionadora segura/);
    await quantity.fill("3");
    await expect(page.getByText("Cantidad actualizada.")).toBeVisible();

    await page.getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByRole("heading", { name: "Tu carrito está vacío" })).toBeVisible();

    expect(mutatingRequests).toEqual([]);
    expect(apiRequests).toEqual([]);
  });

  // The drawer is the primary flow now, so the cart icon opening it is the path a real visitor
  // takes. Stops at the contact step: confirming writes an order, and an E2E smoke run must not
  // leave rows behind in the database it shares with every other test.
  test("opens the order drawer from the cart icon and reaches the contact step", { tag: ["@critical", "@e2e", "@cart", "@CART-E2E-004"] }, async ({ page }) => {
    await page.goto("/productos");
    await page.getByRole("button", { name: "Agregar" }).first().click();
    await expect(page.getByText("Fusionadora segura se agregó al carrito.")).toBeAttached();

    await page.getByRole("link", { name: "Carrito" }).first().click();

    const drawer = page.getByRole("dialog", { name: "Tu pedido" });
    await expect(drawer).toBeVisible();

    // Geometry, not just presence. The drawer is rendered from the header, which carries
    // `backdrop-blur-xl` — and a backdrop-filter makes that element the containing block for
    // any fixed descendant. Rendered in place, the panel was laid out against the header and
    // collapsed into a clipped box in the corner while its backdrop still blocked the page.
    // It was "visible" throughout, so only measuring it catches the regression.
    const viewport = page.viewportSize();
    const box = await drawer.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan((viewport?.height ?? 0) * 0.9);
    expect(box!.y).toBeLessThan(5);

    // The page behind must stay reachable: a backdrop confined to the header would leave the
    // rest of the document covered by nothing, but a mis-sized one covers what it should not.
    await expect(drawer.getByText("Subtotal")).toBeVisible();

    await drawer.getByRole("button", { name: "Continuar con mis datos" }).click();
    await expect(drawer.getByLabel("Correo")).toBeVisible();

    // Escape closes it, which is the contract every modal owes a keyboard user.
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
  });

  test("recovers from a hostile cached currency without fake totals or a formatting crash", { tag: ["@critical", "@e2e", "@cart", "@CART-E2E-002"] }, async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("soprotelco_quote_cart", JSON.stringify([{
        id: "00000000-0000-4000-8000-000000000001",
        slug: "fusionadora-segura",
        name: "Fusionadora segura",
        priceCents: 1500000,
        currency: "NOT_A_CURRENCY",
        quantity: 1,
      }]));
    });

    await page.goto("/carrito");

    await expect(page.getByRole("heading", { name: "Tu carrito está vacío" })).toBeVisible();
    await expect(page.getByText("Total estimado:")).not.toBeVisible();
  });
});
