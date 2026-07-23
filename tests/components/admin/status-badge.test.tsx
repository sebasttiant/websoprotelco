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
});
