import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/server/auth/actions", () => ({
  signUp: vi.fn(),
}));

import { SignUpForm } from "@/app/registro/sign-up-form";

describe("SignUpForm password policy", () => {
  test("advertises the same 12-character minimum enforced by the server", () => {
    render(<SignUpForm />);

    expect(screen.getByLabelText(/contraseña/i)).toHaveAttribute("minlength", "12");
  });
});
