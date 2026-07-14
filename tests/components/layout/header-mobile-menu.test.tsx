import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { HeaderMobileMenu } from "@/components/layout/header-mobile-menu";

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/productos", label: "Productos" },
  { href: "/contacto", label: "Contacto" },
];

function renderMenu() {
  render(<HeaderMobileMenu links={LINKS} />);
  return {
    user: userEvent.setup(),
    toggle: () => screen.getByRole("button", { name: /menú/i }),
  };
}

describe("HeaderMobileMenu", () => {
  test("starts closed so the drawer does not cover the page on load", () => {
    renderMenu();

    expect(screen.getByRole("button", { name: /abrir menú/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("navigation", { name: /móvil/i })).not.toBeInTheDocument();
  });

  test("opens the drawer with the navigation links", async () => {
    const { user, toggle } = renderMenu();

    await user.click(toggle());

    const drawer = screen.getByRole("navigation", { name: /móvil/i });
    expect(drawer).toBeInTheDocument();
    for (const link of LINKS) {
      expect(screen.getByRole("link", { name: link.label })).toHaveAttribute("href", link.href);
    }
  });

  test("reports the open state to assistive technology", async () => {
    const { user, toggle } = renderMenu();

    await user.click(toggle());

    expect(screen.getByRole("button", { name: /cerrar menú/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  test("closes again when the toggle is pressed twice", async () => {
    const { user, toggle } = renderMenu();

    await user.click(toggle());
    await user.click(toggle());

    expect(screen.queryByRole("navigation", { name: /móvil/i })).not.toBeInTheDocument();
  });

  test("closes when a link is followed so the drawer does not linger on the next page", async () => {
    const { user, toggle } = renderMenu();

    await user.click(toggle());
    await user.click(screen.getByRole("link", { name: "Productos" }));

    expect(screen.queryByRole("navigation", { name: /móvil/i })).not.toBeInTheDocument();
  });

  test("offers login inside the drawer, the only place it is reachable on a phone", async () => {
    const { user, toggle } = renderMenu();

    await user.click(toggle());

    expect(screen.getByRole("link", { name: /iniciar sesión/i })).toHaveAttribute("href", "/login");
  });

  test("offers the account and sign-out to a signed-in visitor instead of login", async () => {
    render(<HeaderMobileMenu links={LINKS} isSignedIn />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /abrir menú/i }));

    expect(screen.getByRole("link", { name: /mi cuenta/i })).toHaveAttribute("href", "/cuenta");
    expect(screen.getByRole("button", { name: /cerrar sesión/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /iniciar sesión/i })).not.toBeInTheDocument();
  });

  test("closes on Escape", async () => {
    const { user, toggle } = renderMenu();

    await user.click(toggle());
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("navigation", { name: /móvil/i })).not.toBeInTheDocument();
  });
});
