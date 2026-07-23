import { describe, expect, test } from "vitest";

import {
  documentCategoryLabel,
  formatDate,
  formatDateTime,
  leadSourceLabel,
  leadStatusLabel,
  movementTypeLabel,
  productStatusLabel,
  quoteStatusLabel,
  roleLabel,
  statusLabel,
} from "@/lib/presentation";

describe("role labels", () => {
  test("maps every role to professional Spanish", () => {
    expect(roleLabel("admin")).toBe("Administrador");
    expect(roleLabel("staff")).toBe("Personal");
    // `customer` is a first-party role since 0012_customer_role.sql; without an entry it
    // fell through to the raw English identifier in Spanish admin surfaces.
    expect(roleLabel("customer")).toBe("Cliente");
  });
});

describe("product status labels", () => {
  test("maps active/inactive", () => {
    expect(productStatusLabel("active")).toBe("Activo");
    expect(productStatusLabel("inactive")).toBe("Inactivo");
  });
});

describe("lead status labels", () => {
  test("maps every lead status", () => {
    expect(leadStatusLabel("new")).toBe("Nuevo");
    expect(leadStatusLabel("contacted")).toBe("Contactado");
    expect(leadStatusLabel("qualified")).toBe("Calificado");
    expect(leadStatusLabel("converted")).toBe("Convertido");
    expect(leadStatusLabel("lost")).toBe("Perdido");
  });
});

describe("lead source labels", () => {
  test("maps every lead source", () => {
    expect(leadSourceLabel("contact_form")).toBe("Formulario de contacto");
    expect(leadSourceLabel("whatsapp")).toBe("WhatsApp");
    expect(leadSourceLabel("manual")).toBe("Manual");
    expect(leadSourceLabel("other")).toBe("Otro");
  });
});

describe("quote status labels", () => {
  test("maps every quote status with correct gender", () => {
    expect(quoteStatusLabel("received")).toBe("Recibida");
    expect(quoteStatusLabel("in_review")).toBe("En revisión");
    expect(quoteStatusLabel("quoted")).toBe("Cotizada");
    expect(quoteStatusLabel("won")).toBe("Ganada");
    expect(quoteStatusLabel("lost")).toBe("Perdida");
    expect(quoteStatusLabel("cancelled")).toBe("Cancelada");
  });
});

describe("movement type labels", () => {
  test("maps every movement type", () => {
    expect(movementTypeLabel("sale")).toBe("Venta");
    expect(movementTypeLabel("purchase")).toBe("Compra");
    expect(movementTypeLabel("adjustment")).toBe("Ajuste");
    expect(movementTypeLabel("return")).toBe("Devolución");
  });
});

describe("document category labels", () => {
  test("maps every document category", () => {
    expect(documentCategoryLabel("manual")).toBe("Manual");
    expect(documentCategoryLabel("datasheet")).toBe("Ficha técnica");
    expect(documentCategoryLabel("certificate")).toBe("Certificado");
    expect(documentCategoryLabel("warranty")).toBe("Garantía");
    expect(documentCategoryLabel("other")).toBe("Otro");
  });
});

describe("generic statusLabel fallback", () => {
  test("resolves a known value to Spanish", () => {
    expect(statusLabel("active")).toBe("Activo");
    expect(statusLabel("received")).toBe("Recibida");
  });

  test("never crashes on an unknown value and returns a readable fallback", () => {
    // A value we do not have a translation for should degrade to a humanized string,
    // never throw and never leak a raw snake_case identifier with underscores.
    expect(statusLabel("some_unknown_state")).toBe("Some unknown state");
    expect(statusLabel("")).toBe("");
  });
});

describe("date formatting", () => {
  const date = new Date("2026-03-08T14:30:00Z");

  test("formatDate uses es-CO day/month/year", () => {
    // es-CO renders 8/03/2026 style; assert the parts rather than an exact separator so the
    // test is resilient to Intl data differences across Node versions.
    const formatted = formatDate(date);
    expect(formatted).toContain("2026");
    expect(formatted).toContain("03");
    expect(formatted).toContain("08");
  });

  test("formatDate accepts an ISO string", () => {
    expect(formatDate("2026-03-08T14:30:00Z")).toContain("2026");
  });

  test("formatDateTime includes a time component", () => {
    const formatted = formatDateTime(date);
    expect(formatted).toMatch(/\d{1,2}:\d{2}/);
  });

  test("invalid dates degrade to an em dash instead of 'Invalid Date'", () => {
    expect(formatDate("not-a-date")).toBe("—");
    expect(formatDateTime(null)).toBe("—");
  });
});
