import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { StatusBadge } from "@/components/admin/status-badge";

describe("StatusBadge", () => {
  test("renders known statuses in Spanish, not the raw value", () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText("Activo")).toBeInTheDocument();
  });

  test("humanizes an unknown status instead of showing underscores", () => {
    render(<StatusBadge status="in_review" />);
    // in_review resolves via the combined map to the quote wording.
    expect(screen.getByText("En revisión")).toBeInTheDocument();
  });

  test("honors an explicit label for gendered domains", () => {
    // A quote that is "lost" must read "Perdida", overriding the combined-map default.
    render(<StatusBadge status="lost" label="Perdida" />);
    expect(screen.getByText("Perdida")).toBeInTheDocument();
  });

  test("shows an icon for a known status, hidden from assistive tech", () => {
    const { container } = render(<StatusBadge status="won" label="Ganada" />);

    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
    // The word still carries the meaning; the icon only reinforces it.
    expect(screen.getByText("Ganada")).toBeInTheDocument();
  });

  test("renders text-only, without a broken icon slot, for an unmapped status", () => {
    const { container } = render(<StatusBadge status="totally_unknown" />);

    expect(container.querySelector("svg")).toBeNull();
    // Still degrades to humanized text rather than the raw underscore value.
    expect(screen.getByText("Totally unknown")).toBeInTheDocument();
  });
});
