import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockUsePathname } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
}));

const { AdminSidebar } = await import("@/components/admin/sidebar");

function renderSidebar(pathname: string, role: "admin" | "staff" = "admin") {
  mockUsePathname.mockReturnValue(pathname);
  render(<AdminSidebar role={role} />);
  return screen.getByRole("navigation", { name: /admin/i });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("AdminSidebar", () => {
  test("links every admin section for an admin", () => {
    const nav = renderSidebar("/admin");

    // Labels stay English to match the admin pages they lead to; the storefront is Spanish.
    for (const [label, href] of [
      ["Dashboard", "/admin"],
      ["Products", "/admin/products"],
      ["Categories", "/admin/categories"],
      ["Quotes", "/admin/quotes"],
      ["Leads", "/admin/leads"],
      ["Inventory", "/admin/inventory"],
      ["Documents", "/admin/documents"],
      ["Design", "/admin/design"],
      ["Users", "/admin/users"],
      ["Settings", "/admin/settings"],
    ]) {
      expect(within(nav).getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  });

  test("marks the section matching the current route", () => {
    const nav = renderSidebar("/admin/products");

    expect(within(nav).getByRole("link", { name: "Products" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("keeps the section marked on its nested routes", () => {
    // Editing a product lives at /admin/products/<id>, and the nav must not go blank there.
    const nav = renderSidebar("/admin/products/abc-123");

    expect(within(nav).getByRole("link", { name: "Products" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("does not mark Dashboard active for every admin route", () => {
    // "/admin" is a prefix of every other admin path, so a naive startsWith would light it up
    // on every page.
    const nav = renderSidebar("/admin/products");

    expect(within(nav).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  test("marks Dashboard active on the admin index itself", () => {
    const nav = renderSidebar("/admin");

    expect(within(nav).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

// Filtering the nav is a usability concern, not the security boundary — the pages guard
// themselves. It exists so nobody is shown a door that answers 404, which is also what
// requirePermission's use of notFound() is trying to achieve.
describe("AdminSidebar for a staff user", () => {
  test("shows the sections staff has permission to open", () => {
    const nav = renderSidebar("/admin", "staff");

    for (const label of ["Dashboard", "Products", "Categories", "Quotes", "Leads", "Inventory", "Documents"]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  test("hides the sections that would answer 404", () => {
    const nav = renderSidebar("/admin", "staff");

    for (const label of ["Design", "Settings", "Users"]) {
      expect(within(nav).queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
  });

  test("keeps every section for an admin", () => {
    const nav = renderSidebar("/admin", "admin");

    for (const label of ["Design", "Settings", "Users"]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }
  });
});
