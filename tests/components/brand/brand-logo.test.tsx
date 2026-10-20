import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { BrandLogo } from "@/components/brand/brand-logo";

describe("BrandLogo", () => {
  test("uses the full logo by default so the legend can be read", () => {
    render(<BrandLogo alt="SOPROTELCO" tone="dark" />);

    expect(screen.getByRole("img", { name: "SOPROTELCO" })).toHaveAttribute(
      "src",
      expect.stringContaining("soprotelco-logo-white.svg"),
    );
  });

  test("uses the symbol artwork on the symbol variant", () => {
    render(<BrandLogo alt="SOPROTELCO" tone="dark" variant="symbol" />);

    expect(screen.getByRole("img", { name: "SOPROTELCO" })).toHaveAttribute(
      "src",
      expect.stringContaining("soprotelco-symbol-white.svg"),
    );
  });

  test("renders the symbol shorter than the full logo at the same size so tight bars stay slim", () => {
    const { unmount } = render(<BrandLogo alt="SOPROTELCO" tone="dark" size="lg" />);
    const fullClass = screen.getByRole("img", { name: "SOPROTELCO" }).className;
    unmount();

    render(<BrandLogo alt="SOPROTELCO" tone="dark" variant="symbol" size="lg" />);
    const symbolClass = screen.getByRole("img", { name: "SOPROTELCO" }).className;

    expect(symbolClass).not.toBe(fullClass);
    expect(symbolClass).toContain("h-11");
    expect(fullClass).toContain("h-16");
  });
});
