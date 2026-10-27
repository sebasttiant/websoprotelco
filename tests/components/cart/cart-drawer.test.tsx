import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { CartDrawer } from "@/components/cart/cart-drawer";
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

const CABLE: CartItem = {
  id: "00000000-0000-4000-8000-000000000002",
  slug: "cable-fibra",
  name: "Cable de fibra",
  priceCents: 250000,
  currency: "COP",
  quantity: 1,
};

function renderDrawer(props: Partial<{ open: boolean; onClose: () => void; whatsappNumber: string }> = {}) {
  const onClose = props.onClose ?? vi.fn();
  render(<CartDrawer open={props.open ?? true} onClose={onClose} whatsappNumber={props.whatsappNumber ?? "+57 300 123 4567"} />);
  return { onClose };
}

async function fillContactForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nombre"), "Juan Pérez");
  await user.type(screen.getByLabelText("Correo"), "juan@ejemplo.com");
  await user.type(screen.getByLabelText("Teléfono"), "3001234567");
  await user.type(screen.getByLabelText("Notas (opcional)"), "Calle 1");
}

beforeEach(() => {
  submitCartOrder.mockReset();
});

afterEach(() => {
  window.localStorage.clear();
  document.body.style.overflow = "";
});

describe("CartDrawer dialog behavior", () => {
  test("is an accessible modal dialog that follows the open prop", () => {
    const { rerender } = render(<CartDrawer open={false} onClose={() => {}} whatsappNumber="" />);

    // aria-hidden removes it from the accessible tree, so it is found by role only with `hidden`.
    const closed = screen.getByRole("dialog", { hidden: true });
    expect(closed).toHaveAttribute("aria-label", "Tu pedido");
    expect(closed).toHaveAttribute("aria-modal", "true");
    expect(closed).toHaveAttribute("aria-hidden", "true");
    expect(closed).toHaveClass("translate-x-full", "pointer-events-none", "h-dvh", "max-w-[26rem]");

    rerender(<CartDrawer open onClose={() => {}} whatsappNumber="" />);

    const opened = screen.getByRole("dialog", { name: "Tu pedido" });
    expect(opened).toHaveAttribute("aria-hidden", "false");
    expect(opened).toHaveClass("translate-x-0");
  });

  test("moves focus to the close button on open and closes on Escape", () => {
    const { onClose } = renderDrawer();

    expect(screen.getByRole("button", { name: "Cerrar el pedido" })).toHaveFocus();

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("ignores Escape while closed", () => {
    const { onClose } = renderDrawer({ open: false });

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  test("closes from the close button and from the backdrop", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer();

    await user.click(screen.getByRole("button", { name: "Cerrar el pedido" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    const backdrop = document.body.querySelector<HTMLElement>('div[aria-hidden="true"].fixed.inset-0');
    expect(backdrop).not.toBeNull();
    await user.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test("locks body scroll while open and restores the previous value", () => {
    document.body.style.overflow = "scroll";
    const { unmount } = render(<CartDrawer open onClose={() => {}} whatsappNumber="" />);

    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("scroll");
  });
});

describe("CartDrawer cart step", () => {
  test("shows the empty state with a catalog link that closes the drawer", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer();

    expect(screen.getByText("Tu pedido está vacío.")).toBeInTheDocument();
    expect(screen.queryByText("Subtotal")).not.toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Ver catálogo" });
    expect(link).toHaveAttribute("href", "/productos");

    await user.click(link);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("lists stored items with unit price, quantity input and subtotal", () => {
    writeCart([FUSIONADORA, CABLE]);
    renderDrawer();

    expect(screen.getByText("Fusionadora segura")).toBeInTheDocument();
    expect(screen.getByText(/15\.000/, { selector: "p" })).toHaveTextContent(/c\/u$/);
    expect(screen.getAllByLabelText("Cantidad")).toHaveLength(2);

    const quantity = screen.getAllByLabelText("Cantidad")[0];
    expect(quantity).toHaveValue(2);
    expect(quantity).toHaveAttribute("min", "1");
    expect(quantity).toHaveAttribute("max", "99");
    expect(quantity).toHaveAttribute("id", `drawer-qty-${FUSIONADORA.id}`);

    // 2 × 15.000 + 1 × 2.500 = 32.500
    expect(screen.getByRole("status")).toHaveTextContent(/32\.500/);
  });

  test("persists a valid quantity change and updates the subtotal", () => {
    writeCart([FUSIONADORA]);
    renderDrawer();

    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "3" } });

    expect(readCart()[0].quantity).toBe(3);
    expect(screen.getByRole("status")).toHaveTextContent(/45\.000/);
  });

  test("normalizes quantities above the limit", () => {
    writeCart([FUSIONADORA]);
    renderDrawer();

    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "150" } });

    expect(readCart()[0].quantity).toBe(99);
  });

  test("rejects an invalid quantity with an alert and leaves the cart untouched", () => {
    writeCart([FUSIONADORA]);
    renderDrawer();

    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "0" } });

    expect(screen.getByRole("alert")).toHaveTextContent("La cantidad debe ser un número entero mayor que cero.");
    expect(readCart()[0].quantity).toBe(2);

    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "4" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("removes an item and falls back to the empty state", async () => {
    const user = userEvent.setup();
    writeCart([FUSIONADORA]);
    renderDrawer();

    await user.click(screen.getByRole("button", { name: "Quitar Fusionadora segura del pedido" }));

    expect(readCart()).toEqual([]);
    expect(screen.getByText("Tu pedido está vacío.")).toBeInTheDocument();
  });

  test("follows cart changes made elsewhere in the page", () => {
    renderDrawer();
    expect(screen.getByText("Tu pedido está vacío.")).toBeInTheDocument();

    act(() => writeCart([CABLE]));

    expect(screen.getByText("Cable de fibra")).toBeInTheDocument();
  });

  test("blocks checkout when the total cannot be represented", () => {
    writeCart([{ ...FUSIONADORA, priceCents: Number.MAX_SAFE_INTEGER, quantity: 99 }]);
    renderDrawer();

    expect(screen.getByRole("alert")).toHaveTextContent("No podemos calcular el total de esta selección.");
    expect(screen.getByRole("button", { name: "Continuar con mis datos" })).toBeDisabled();
  });
});

describe("CartDrawer order flow", () => {
  test("submits only ids and quantities, then confirms with a WhatsApp link", async () => {
    const user = userEvent.setup();
    submitCartOrder.mockResolvedValue({
      success: true,
      reference: "PED-2026-0042",
      totalCents: 3250000,
      lines: [
        { productId: FUSIONADORA.id, name: FUSIONADORA.name, quantity: 2, unitPriceCents: FUSIONADORA.priceCents },
        { productId: CABLE.id, name: CABLE.name, quantity: 1, unitPriceCents: CABLE.priceCents },
      ],
    });
    writeCart([FUSIONADORA, CABLE]);
    renderDrawer();

    await user.click(screen.getByRole("button", { name: "Continuar con mis datos" }));

    const whatsapp = screen.getByRole("button", { name: "Confirmar pedido por WhatsApp" });
    const email = screen.getByRole("button", { name: "Enviar pedido por formulario" });
    expect(whatsapp).toBeDisabled();
    expect(email).toBeDisabled();
    expect(screen.queryByText("Tu pedido está vacío.")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Cantidad")).not.toBeInTheDocument();

    await fillContactForm(user);
    expect(whatsapp).toBeEnabled();
    expect(email).toBeEnabled();

    await user.click(whatsapp);

    expect(submitCartOrder).toHaveBeenCalledTimes(1);
    expect(submitCartOrder).toHaveBeenCalledWith({
      name: "Juan Pérez",
      email: "juan@ejemplo.com",
      phone: "3001234567",
      notes: "Calle 1",
      items: [
        { productId: FUSIONADORA.id, quantity: 2 },
        { productId: CABLE.id, quantity: 1 },
      ],
      expectedUnitPrices: [
        { productId: FUSIONADORA.id, unitPriceCents: FUSIONADORA.priceCents },
        { productId: CABLE.id, unitPriceCents: CABLE.priceCents },
      ],
      acceptPriceRevision: false,
    });

    expect(await screen.findByRole("heading", { name: "Pedido recibido" })).toBeInTheDocument();
    expect(screen.getByText("PED-2026-0042")).toBeInTheDocument();
    expect(screen.getByText(/32\.500/)).toBeInTheDocument();
    expect(readCart()).toEqual([]);
    expect(screen.queryByText("Subtotal")).not.toBeInTheDocument();
    expect(screen.queryByText("Tu pedido está vacío.")).not.toBeInTheDocument();

    const format = (cents: number) =>
      new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(cents / 100);
    const message = [
      "Hola, confirmo mi pedido PED-2026-0042:",
      `2 × Fusionadora segura — ${format(3000000)}`,
      `1 × Cable de fibra — ${format(250000)}`,
      `Total: ${format(3250000)}`,
      "Quedo atento para coordinar pago y entrega.",
    ].join("\n");
    const link = screen.getByRole("link", { name: "Abrir WhatsApp" });
    expect(link).toHaveAttribute("href", `https://wa.me/573001234567?text=${encodeURIComponent(message)}`);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer noopener");
  });

  test("confirming by email records the order without offering WhatsApp", async () => {
    const user = userEvent.setup();
    submitCartOrder.mockResolvedValue({
      success: true,
      reference: "PED-2026-0043",
      totalCents: 250000,
      lines: [{ productId: CABLE.id, name: CABLE.name, quantity: 1, unitPriceCents: CABLE.priceCents }],
    });
    writeCart([CABLE]);
    renderDrawer();

    await user.click(screen.getByRole("button", { name: "Continuar con mis datos" }));
    await fillContactForm(user);
    await user.click(screen.getByRole("button", { name: "Enviar pedido por formulario" }));

    expect(await screen.findByText("PED-2026-0043")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Abrir WhatsApp" })).not.toBeInTheDocument();
  });

  test("hides the WhatsApp path when no number is configured", async () => {
    const user = userEvent.setup();
    writeCart([CABLE]);
    renderDrawer({ whatsappNumber: "" });

    await user.click(screen.getByRole("button", { name: "Continuar con mis datos" }));

    expect(screen.queryByRole("button", { name: "Confirmar pedido por WhatsApp" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar pedido por formulario" })).toBeInTheDocument();
  });

  test("keeps the cart and shows the server message when the order is rejected", async () => {
    const user = userEvent.setup();
    submitCartOrder.mockResolvedValue({ success: false, message: "Revisá los datos de contacto y los productos del pedido." });
    writeCart([CABLE]);
    renderDrawer();

    await user.click(screen.getByRole("button", { name: "Continuar con mis datos" }));
    await fillContactForm(user);
    await user.click(screen.getByRole("button", { name: "Enviar pedido por formulario" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Revisá los datos de contacto y los productos del pedido.");
    expect(readCart()).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Pedido recibido" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar pedido por formulario" })).toBeEnabled();
  });

  test("disables both confirmations and shows progress while the order is pending", async () => {
    const user = userEvent.setup();
    let resolve: (value: unknown) => void = () => {};
    submitCartOrder.mockReturnValue(new Promise((done) => (resolve = done)));
    writeCart([CABLE]);
    renderDrawer();

    await user.click(screen.getByRole("button", { name: "Continuar con mis datos" }));
    await fillContactForm(user);
    await user.click(screen.getByRole("button", { name: "Enviar pedido por formulario" }));

    const pending = screen.getAllByRole("button", { name: "Confirmando…" });
    expect(pending).toHaveLength(2);
    pending.forEach((button) => expect(button).toBeDisabled());

    await act(async () => resolve({ success: false, message: "Falló." }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Falló."));
  });

  test("returning to the store resets the flow and closes the drawer", async () => {
    const user = userEvent.setup();
    submitCartOrder.mockResolvedValue({
      success: true,
      reference: "PED-2026-0044",
      totalCents: 250000,
      lines: [{ productId: CABLE.id, name: CABLE.name, quantity: 1, unitPriceCents: CABLE.priceCents }],
    });
    writeCart([CABLE]);
    const { onClose } = renderDrawer();

    await user.click(screen.getByRole("button", { name: "Continuar con mis datos" }));
    await fillContactForm(user);
    await user.click(screen.getByRole("button", { name: "Enviar pedido por formulario" }));
    await user.click(await screen.findByRole("button", { name: "Volver a la tienda" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("heading", { name: "Pedido recibido" })).not.toBeInTheDocument();
    expect(screen.getByText("Tu pedido está vacío.")).toBeInTheDocument();

    // The next order starts from a blank form.
    act(() => writeCart([CABLE]));
    await user.click(screen.getByRole("button", { name: "Continuar con mis datos" }));
    expect(screen.getByLabelText("Nombre")).toHaveValue("");
    expect(screen.getByLabelText("Notas (opcional)")).toHaveValue("");
  });

  test("discloses a stale cart price, refreshes the line, and confirms only after accept", async () => {
    const user = userEvent.setup();
    const revisedCents = 200000;
    submitCartOrder
      .mockResolvedValueOnce({
        success: false,
        code: "price-changed",
        message:
          "Algunos precios del carrito cambiaron. Revisá el nuevo total y confirmá de nuevo para continuar.",
        totalCents: revisedCents,
        lines: [{ productId: CABLE.id, name: CABLE.name, quantity: 1, unitPriceCents: revisedCents }],
      })
      .mockResolvedValueOnce({
        success: true,
        reference: "PED-2026-0099",
        totalCents: revisedCents,
        lines: [{ productId: CABLE.id, name: CABLE.name, quantity: 1, unitPriceCents: revisedCents }],
      });
    writeCart([CABLE]);
    renderDrawer();

    await user.click(screen.getByRole("button", { name: "Continuar con mis datos" }));
    await fillContactForm(user);
    await user.click(screen.getByRole("button", { name: "Enviar pedido por formulario" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/precios del carrito cambiaron/i);
    expect(readCart()[0]?.priceCents).toBe(revisedCents);
    expect(submitCartOrder).toHaveBeenLastCalledWith(expect.objectContaining({ acceptPriceRevision: false }));

    await user.click(screen.getByRole("button", { name: "Enviar pedido por formulario" }));

    expect(submitCartOrder).toHaveBeenLastCalledWith(expect.objectContaining({ acceptPriceRevision: true }));
    expect(await screen.findByText("PED-2026-0099")).toBeInTheDocument();
  });

  test("renders the contact fields with their input semantics", async () => {
    const user = userEvent.setup();
    writeCart([CABLE]);
    renderDrawer();

    await user.click(screen.getByRole("button", { name: "Continuar con mis datos" }));

    expect(screen.getByLabelText("Nombre")).toMatchObject({ type: "text", id: "drawer-name", required: true });
    expect(screen.getByLabelText("Nombre")).toHaveAttribute("autocomplete", "name");
    expect(screen.getByLabelText("Correo")).toMatchObject({ type: "email", id: "drawer-email", required: true });
    expect(screen.getByLabelText("Correo")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Teléfono")).toMatchObject({ type: "tel", id: "drawer-phone", required: true });
    expect(screen.getByLabelText("Teléfono")).toHaveAttribute("autocomplete", "tel");
    expect(screen.getByLabelText("Notas (opcional)")).toHaveAttribute("rows", "3");
  });
});
