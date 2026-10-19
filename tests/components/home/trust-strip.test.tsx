import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { TrustStrip } from "@/components/home/trust-strip";

describe("TrustStrip", () => {
  test("renders the four commercial trust signals", () => {
    render(<TrustStrip />);

    const region = screen.getByRole("region", { name: /respaldo comercial/i });
    expect(within(region).getByText("Envíos nacionales")).toBeInTheDocument();
    expect(within(region).getByText("Stock disponible")).toBeInTheDocument();
    expect(within(region).getByText("Asesoría técnica")).toBeInTheDocument();
    expect(within(region).getByText("Cotización WhatsApp")).toBeInTheDocument();
  });
});
