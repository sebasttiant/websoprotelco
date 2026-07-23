import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/components/layout/header", () => ({ Header: () => null }));
vi.mock("@/components/layout/footer", () => ({ Footer: () => null }));

const { default: ContactPage } = await import("@/app/contacto/page");

async function renderPage(producto?: string) {
  render(await ContactPage({ searchParams: Promise.resolve({ producto }) }));
}

describe("ContactPage", () => {
  test("keeps the legacy contact fields accessible without a submitting form", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Contáctanos" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre Completo")).toBeRequired();
    expect(screen.getByLabelText("Correo Electrónico")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("WhatsApp / Teléfono")).toBeRequired();
    expect(screen.getByLabelText("Tu mensaje")).toBeRequired();
    expect(screen.getByRole("status")).toHaveTextContent(/envío en línea todavía no está disponible/i);
    expect(document.querySelector("form")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contactar por WhatsApp" })).toHaveAttribute(
      "href",
      "https://wa.me/573001234567",
    );
    expect(screen.getByRole("button", { name: "Preparar mensaje" })).toHaveAttribute("type", "button");
  });

  test("preserves only a well-formed product handoff", async () => {
    await renderPage("fusionadora-optica");

    expect(screen.getByText("Producto consultado: fusionadora-optica")).toBeInTheDocument();
  });

  test("drops malformed product handoff values", async () => {
    await renderPage("<script>alert(1)</script>");

    expect(screen.queryByText(/Producto consultado:/)).not.toBeInTheDocument();
  });
});
