import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

const { mockCreateUser } = vi.hoisted(() => ({ mockCreateUser: vi.fn() }));

vi.mock("@/domains/users/actions", () => ({ createUser: mockCreateUser }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { NewUserModal } from "@/components/admin/new-user-modal";

function openAndFill(password: string) {
  render(<NewUserModal roles={["admin", "staff", "customer"]} />);
  fireEvent.click(screen.getByRole("button", { name: /nuevo usuario/i }));
  fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: "Ana Admin" } });
  fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: "ana@empresa.com" } });
  fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: password } });
}

describe("NewUserModal password policy", () => {
  test("states the 12 character minimum", () => {
    openAndFill("");

    expect(screen.getByLabelText(/contraseña/i)).toHaveAttribute("placeholder", expect.stringContaining("12"));
  });

  test.each([8, 11])("keeps submit disabled for a %i-character password", (length) => {
    openAndFill("x".repeat(length));

    expect(screen.getByRole("button", { name: /registrar usuario/i })).toBeDisabled();
  });

  test("enables submit at exactly 12 characters", () => {
    openAndFill("x".repeat(12));

    expect(screen.getByRole("button", { name: /registrar usuario/i })).toBeEnabled();
  });
});
