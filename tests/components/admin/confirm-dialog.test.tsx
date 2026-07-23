import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";

function renderInForm(onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())) {
  return render(
    <form onSubmit={onSubmit}>
      <ConfirmDialog message='¿Eliminar el producto "Cable X"? Esta acción no se puede deshacer.'>
        Eliminar
      </ConfirmDialog>
    </form>,
  );
}

describe("ConfirmDialog", () => {
  test("does not show the dialog until the trigger is pressed", () => {
    renderInForm();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /eliminar/i })).toBeInTheDocument();
  });

  test("opens an accessible Spanish dialog with the entity and consequence", async () => {
    renderInForm();
    await userEvent.click(screen.getByRole("button", { name: /eliminar/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByText(/cable x/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/no se puede deshacer/i)).toBeInTheDocument();
  });

  test("Cancel is the safe default: it receives focus and closes without submitting", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    renderInForm(onSubmit);
    await userEvent.click(screen.getByRole("button", { name: /^eliminar$/i }));

    const cancel = screen.getByRole("button", { name: /cancelar/i });
    await waitFor(() => expect(cancel).toHaveFocus());

    await userEvent.click(cancel);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("Escape cancels the dialog", async () => {
    renderInForm();
    await userEvent.click(screen.getByRole("button", { name: /^eliminar$/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("the confirm control submits the enclosing form", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    renderInForm(onSubmit);
    await userEvent.click(screen.getByRole("button", { name: /^eliminar$/i }));

    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /eliminar/i }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
