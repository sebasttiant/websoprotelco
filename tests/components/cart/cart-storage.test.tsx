import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";

import { CartContent } from "@/components/cart/cart-content";
import { CartProductCard } from "@/components/cart/cart-product-card";
import { calculateCartTotal, CART_QUANTITY_LIMIT, type CartItem, validateQuantity } from "@/components/cart/cart-storage";

afterEach(() => window.localStorage.clear());

describe("cart quantity validation", () => {
  test.each([0, -1, 1.5, Number.NaN])("rejects invalid quantity %s", (quantity) => {
    expect(validateQuantity(quantity)).toMatchObject({ valid: false });
  });

  test("normalizes quantities above the local cart limit", () => {
    expect(validateQuantity(CART_QUANTITY_LIMIT + 1)).toEqual({ valid: true, quantity: CART_QUANTITY_LIMIT, normalized: true });
  });
});

describe("cart total safe-integer bounds", () => {
  const item = (priceCents: number, quantity: number): CartItem => ({
    id: "00000000-0000-4000-8000-000000000001",
    slug: "fusionadora-segura",
    name: "Fusionadora segura",
    priceCents,
    currency: "COP",
    quantity,
  });

  test("sums an ordinary selection exactly", () => {
    expect(calculateCartTotal([item(1500000, 2)])).toEqual({ valid: true, totalCents: 3000000 });
  });

  test("refuses a line total that leaves the safe-integer range", () => {
    // A stored priceCents at the schema's own upper bound times the quantity limit silently
    // loses precision in IEEE-754, which would render a confidently wrong total.
    expect(calculateCartTotal([item(Number.MAX_SAFE_INTEGER, CART_QUANTITY_LIMIT)])).toMatchObject({ valid: false });
  });

  test("refuses an accumulated total that leaves the safe-integer range", () => {
    const half = Math.floor(Number.MAX_SAFE_INTEGER / 2);
    expect(calculateCartTotal([item(half, 1), item(half, 1), item(half, 1)])).toMatchObject({ valid: false });
  });
});

describe("CartContent", () => {
  test("does not offer unavailable catalog products for cart selection", () => {
    render(<CartProductCard product={{ id: "00000000-0000-4000-8000-000000000001", slug: "sin-stock", sku: "SIN-001", name: "Sin stock", description: "", priceCents: 100, currency: "COP", categoryName: "Prueba", categorySlug: "prueba", brand: "SP", imageUrl: null, inStock: false }} />);

    expect(screen.queryByRole("button", { name: "Agregar" })).not.toBeInTheDocument();
    expect(screen.getByText("No disponible")).toBeInTheDocument();
  });

  test("fails closed for hostile browser-local cart entries", async () => {
    window.localStorage.setItem("soprotelco_quote_cart", JSON.stringify([{ id: "00000000-0000-4000-8000-000000000001", slug: "fusionadora-segura", name: "Fusionadora segura", priceCents: 1500000, currency: "NOT_A_CURRENCY", quantity: 1 }, { id: "00000000-0000-4000-8000-000000000002", slug: "<script>", name: "", priceCents: -1, currency: "COP", quantity: 1, imageUrl: "javascript:alert(1)" }]));
    render(<CartContent />);

    expect(await screen.findByRole("heading", { name: "Tu carrito está vacío" })).toBeInTheDocument();
  });

  test("reports an unrepresentable total accessibly instead of a wrong number", async () => {
    window.localStorage.setItem("soprotelco_quote_cart", JSON.stringify([{ id: "00000000-0000-4000-8000-000000000001", slug: "fusionadora-segura", name: "Fusionadora segura", priceCents: Number.MAX_SAFE_INTEGER, currency: "COP", quantity: CART_QUANTITY_LIMIT }]));
    render(<CartContent />);

    expect(await screen.findByRole("alert")).toHaveTextContent("No podemos calcular el total de esta selección.");
    expect(screen.queryByText(/^Total estimado:/)).not.toBeInTheDocument();
  });

  test("shows a safe empty state and a catalog return link", () => {
    render(<CartContent />);

    expect(screen.getByRole("heading", { name: "Tu carrito está vacío" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al catálogo" })).toHaveAttribute("href", "/productos");
  });

  test("updates, rejects invalid quantities, and removes local items", async () => {
    window.localStorage.setItem("soprotelco_quote_cart", JSON.stringify([{ id: "00000000-0000-4000-8000-000000000001", slug: "fusionadora-segura", name: "Fusionadora segura", priceCents: 1500000, currency: "COP", quantity: 1 }]));
    render(<CartContent />);
    const user = userEvent.setup();
    const quantity = await screen.findByLabelText("Cantidad para Fusionadora segura");

    fireEvent.change(quantity, { target: { value: "2" } });
    expect(await screen.findByText("Cantidad actualizada.")).toBeInTheDocument();
    fireEvent.change(quantity, { target: { value: "0" } });
    expect(screen.getByText("La cantidad debe ser un número entero mayor que cero.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(await screen.findByRole("heading", { name: "Tu carrito está vacío" })).toBeInTheDocument();
  });
});
