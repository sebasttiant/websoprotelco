import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import AdminError from "@/app/admin/error";
import AdminLoading from "@/app/admin/loading";
import AdminNotFound from "@/app/admin/not-found";

describe("AdminNotFound", () => {
  test("shows a calm Spanish message and a link back to the panel", () => {
    render(<AdminNotFound />);
    expect(screen.getByRole("heading", { name: /no encontramos lo que buscás/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /volver al panel/i })).toHaveAttribute("href", "/admin");
  });
});

describe("AdminError", () => {
  test("never leaks the raw error message (SQL, stack, internal paths)", () => {
    const leaky = new Error('invalid input syntax for type uuid: "SELECT secret"');
    render(<AdminError error={leaky} reset={() => {}} />);

    expect(screen.queryByText(/invalid input syntax/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/SELECT secret/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /no pudimos cargar esta sección/i })).toBeInTheDocument();
  });

  test("offers a Spanish retry that calls reset", async () => {
    const reset = vi.fn();
    render(<AdminError error={new Error("boom")} reset={reset} />);

    await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(reset).toHaveBeenCalledOnce();
  });

  test("shows the safe digest reference when present", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    render(<AdminError error={error} reset={() => {}} />);
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });
});

describe("AdminLoading", () => {
  test("exposes a busy skeleton to assistive tech", () => {
    render(<AdminLoading />);
    expect(screen.getByLabelText(/cargando/i)).toHaveAttribute("aria-busy", "true");
  });
});
