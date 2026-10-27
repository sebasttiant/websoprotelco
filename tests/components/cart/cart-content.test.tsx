import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { CartContent } from "@/components/cart/cart-content";
import { readCart, writeCart, type CartItem } from "@/components/cart/cart-storage";

const submitCartOrder = vi.hoisted(() => vi.fn());

vi.mock("@/domains/quote-order/actions", () => ({ submitCartOrder }));

const FUSIONADORA: CartItem = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "fusionadora-segura",
  name: "Fusionadora segura",
  priceCents: 1500000,
  currency: "COP",
  quantity: 2,
};

beforeEach(() => {
  submitCartOrder.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("CartContent checkout", () => {
  test("offers the same order checkout as the drawer: contact data and both channels", async () => {
    writeCart([FUSIONADORA]);
    render(<CartContent whatsappNumber="+57 300 123 4567" />);

    expect(await screen.findByText("Fusionadora segura")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar pedido por formulario/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirmar pedido por whatsapp/i })).toBeInTheDocument();
  });

  test("restores the submit controls when the order action rejects", async () => {
    writeCart([FUSIONADORA]);
    submitCartOrder.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<CartContent whatsappNumber="+57 300 123 4567" />);

    await user.type(await screen.findByLabelText("Nombre"), "Juan Pérez");
    await user.type(screen.getByLabelText("Correo"), "juan@ejemplo.com");
    await user.type(screen.getByLabelText("Teléfono"), "3001234567");
    await user.click(screen.getByRole("button", { name: /enviar pedido por formulario/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no pudimos registrar tu pedido/i);
    expect(screen.getByRole("button", { name: /enviar pedido por formulario/i })).toBeEnabled();
    expect(readCart()).toEqual([FUSIONADORA]);
  });

  test("records the order through the form channel and confirms with its reference", async () => {
    writeCart([FUSIONADORA]);
    submitCartOrder.mockResolvedValue({
      success: true,
      reference: "WEB-2026-0007",
      totalCents: 3000000,
      lines: [
        {
          productId: FUSIONADORA.id,
          name: FUSIONADORA.name,
          quantity: 2,
          unitPriceCents: FUSIONADORA.priceCents,
        },
      ],
    });
    const user = userEvent.setup();
    render(<CartContent whatsappNumber="+57 300 123 4567" />);

    await user.type(await screen.findByLabelText("Nombre"), "Juan Pérez");
    await user.type(screen.getByLabelText("Correo"), "juan@ejemplo.com");
    await user.type(screen.getByLabelText("Teléfono"), "3001234567");
    await user.click(screen.getByRole("button", { name: /enviar pedido por formulario/i }));

    expect(await screen.findByText("Pedido recibido")).toBeInTheDocument();
    expect(screen.getByText("WEB-2026-0007")).toBeInTheDocument();
    expect(readCart()).toEqual([]);
    expect(submitCartOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Juan Pérez",
        items: [{ productId: FUSIONADORA.id, quantity: 2 }],
        expectedUnitPrices: [{ productId: FUSIONADORA.id, unitPriceCents: FUSIONADORA.priceCents }],
      }),
    );
  });
});
