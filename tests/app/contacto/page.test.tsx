import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/components/layout/header", () => ({ Header: () => null }));
vi.mock("@/components/layout/footer", () => ({ Footer: () => null }));
vi.mock("@/domains/quote-order/actions", () => ({
  submitContactMessage: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/domains/settings", () => ({
  getSiteSettings: vi.fn().mockResolvedValue({
    siteName: "SOPROTELCO",
    siteDescription: "Soluciones en telecomunicaciones.",
    contactEmail: "info@soprotelco.com",
    contactPhone: "+57 300 123 4567",
    address: "Medellín, Colombia",
    businessHours: "Lun-Vie: 8:00-18:00, Sáb: 9:00-13:00",
    facebookUrl: null,
    instagramUrl: null,
    linkedinUrl: null,
    whatsappNumber: "+573001234567",
  }),
}));

const { default: ContactPage } = await import("@/app/contacto/page");

async function renderPage(producto?: string) {
  render(await ContactPage({ searchParams: Promise.resolve({ producto }) }));
}

describe("ContactPage", () => {
  test("keeps the contact fields accessible and opens WhatsApp with the site number", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Contáctanos" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre Completo")).toBeRequired();
    expect(screen.getByLabelText("Correo Electrónico")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("WhatsApp / Teléfono")).toBeRequired();
    expect(screen.getByLabelText("Tu mensaje")).toBeRequired();
    expect(screen.getByRole("status")).toHaveTextContent(/buzón de SOPROTELCO/i);
    expect(screen.getByRole("status")).toHaveTextContent(/WhatsApp/i);
    expect(screen.getByText("Medellín, Colombia")).toBeInTheDocument();
    expect(document.querySelector("form")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contactar por WhatsApp" })).toHaveAttribute(
      "href",
      "https://wa.me/573001234567",
    );
    expect(screen.getByRole("button", { name: "Enviar y abrir WhatsApp" })).toHaveAttribute("type", "submit");
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
