import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { RevealImage } from "@/components/ui/reveal-image";

describe("RevealImage", () => {
  test("keeps the image accessible while it fades in after load", () => {
    render(<RevealImage src="/uploads/2026-01-01-11111111-1111-4111-8111-111111111111.webp" alt="Fusionadora X" />);

    const image = screen.getByRole("img", { name: "Fusionadora X" });
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image.className).toMatch(/opacity-0/);

    fireEvent.load(image);

    expect(image.className).toMatch(/opacity-100/);
  });

  test("marks priority photos as eager for the product detail LCP", () => {
    render(<RevealImage src="/uploads/2026-01-01-11111111-1111-4111-8111-111111111111.webp" alt="Hero" priority />);

    expect(screen.getByRole("img", { name: "Hero" })).toHaveAttribute("loading", "eager");
  });
});
