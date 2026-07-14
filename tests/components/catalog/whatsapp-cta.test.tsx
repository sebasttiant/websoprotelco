import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { WhatsAppCta } from "@/components/catalog/whatsapp-cta";

function hrefOf(name: RegExp) {
  return screen.getByRole("link", { name }).getAttribute("href") ?? "";
}

describe("WhatsAppCta", () => {
  test("points at the configured number with the punctuation stripped", () => {
    render(<WhatsAppCta whatsappNumber="+57 300 123 4567" productName="Fusionadora" sku="FUS-01" />);

    expect(hrefOf(/whatsapp/i)).toContain("https://wa.me/573001234567");
  });

  test("prefills a message naming the product and its SKU", () => {
    render(<WhatsAppCta whatsappNumber="+573001234567" productName="Fusionadora X" sku="FUS-01" />);

    const url = new URL(hrefOf(/whatsapp/i));
    const text = url.searchParams.get("text") ?? "";

    expect(text).toContain("Fusionadora X");
    expect(text).toContain("FUS-01");
  });

  test("encodes the message so spaces and accents survive the URL", () => {
    render(<WhatsAppCta whatsappNumber="+573001234567" productName="Cable óptico" sku="CAB-9" />);

    const href = hrefOf(/whatsapp/i);

    // A raw space in a query string would truncate the message in some clients.
    expect(href).not.toMatch(/text=[^&]*\s/);
    expect(new URL(href).searchParams.get("text")).toContain("Cable óptico");
  });

  test("opens in a new tab without leaking the referrer", () => {
    render(<WhatsAppCta whatsappNumber="+573001234567" productName="Fusionadora" sku="FUS-01" />);

    const link = screen.getByRole("link", { name: /whatsapp/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  test("renders nothing when no WhatsApp number is configured", () => {
    const { container } = render(<WhatsAppCta whatsappNumber="" productName="Fusionadora" sku="FUS-01" />);

    expect(container).toBeEmptyDOMElement();
  });
});
