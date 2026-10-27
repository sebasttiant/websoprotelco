// @vitest-environment node
import { describe, expect, test } from "vitest";

import { buildContactNotifyEmail, buildOrderNotifyEmail } from "@/server/notifications/ops-mail";

describe("ops mail builders", () => {
  test("builds a structured order email for the ops mailbox", () => {
    const mail = buildOrderNotifyEmail(
      {
        reference: "WEB-ABC",
        contactName: "Ana Pérez",
        contactEmail: "ana@empresa.com",
        contactPhone: "3001234567",
        notes: "Entregar en Medellín",
        totalCents: 80_000_00,
        lines: [{ name: "VFL 10 Kms", quantity: 1, unitPriceCents: 80_000_00 }],
        channelHint: "whatsapp",
      },
      "info@soprotelco.com",
    );

    expect(mail.to).toBe("info@soprotelco.com");
    expect(mail.subject).toContain("WEB-ABC");
    expect(mail.text).toContain("Ana Pérez");
    expect(mail.text).toContain("IVA incluido");
    expect(mail.html).toContain("Nuevo pedido WEB-ABC");
    expect(mail.html).toContain("VFL 10 Kms");
  });

  test("builds a structured contact email", () => {
    const mail = buildContactNotifyEmail(
      {
        name: "Luis",
        email: "luis@empresa.com",
        phone: "3009998877",
        subject: "Cotización de Productos",
        message: "Necesito stock de fusión.",
        productSlug: "fusionadora-x",
      },
      "info@soprotelco.com",
    );

    expect(mail.subject).toContain("Cotización de Productos");
    expect(mail.text).toContain("fusionadora-x");
    expect(mail.html).toContain("Necesito stock de fusión.");
  });
});
