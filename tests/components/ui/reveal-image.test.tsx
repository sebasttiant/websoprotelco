import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { RevealImage } from "@/components/ui/reveal-image";

const SAFE_SRC = "/uploads/2026-01-01-11111111-1111-4111-8111-111111111111.webp";

describe("RevealImage", () => {
  test("keeps the image accessible while it fades in after load", async () => {
    render(<RevealImage src={SAFE_SRC} alt="Fusionadora X" />);

    const image = screen.getByRole("img", { name: "Fusionadora X" });
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image.className).toMatch(/opacity-0/);

    fireEvent.load(image);

    await waitFor(() => expect(image.className).toMatch(/opacity-100/));
  });

  test("marks priority photos as eager for the product detail LCP", () => {
    render(<RevealImage src={SAFE_SRC} alt="Hero" priority />);

    expect(screen.getByRole("img", { name: "Hero" })).toHaveAttribute("loading", "eager");
  });

  test("asks next/image for a responsive sizes hint so the optimizer can pick a srcset width", () => {
    render(<RevealImage src={SAFE_SRC} alt="Card" sizes="(min-width: 640px) 40vw, 90vw" />);

    const image = screen.getByRole("img", { name: "Card" });
    expect(image).toHaveAttribute("sizes", "(min-width: 640px) 40vw, 90vw");
    // next/image rewrites through /_next/image while keeping the safe catalog path as the url=.
    const src = decodeURIComponent(image.getAttribute("src") ?? "");
    expect(src).toContain("/_next/image");
    expect(src).toContain(SAFE_SRC);
  });
});
