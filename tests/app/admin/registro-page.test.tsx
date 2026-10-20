import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/domains/settings", () => ({
  getSiteSettings: vi.fn().mockResolvedValue({
    siteName: "Soprotelco",
    siteDescription: "Telecom",
    businessHours: "L-V",
  }),
}));
vi.mock("@/components/brand/brand-logo", () => ({ BrandLogo: () => null }));
vi.mock("@/app/registro/sign-up-form", () => ({ SignUpForm: () => null }));

import RegisterPage from "@/app/registro/page";

describe("RegisterPage", () => {
  test("tells visitors the password needs at least 12 characters", async () => {
    render(await RegisterPage());

    expect(screen.getByText(/al menos 12 caracteres/i)).toBeInTheDocument();
  });
});
