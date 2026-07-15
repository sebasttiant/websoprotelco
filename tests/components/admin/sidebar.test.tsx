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
  return screen.getByRole("navigation", { name: /secciones/i });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("AdminSidebar", () => {
  test("links every admin section in Spanish", () => {
    const nav = renderSidebar("/admin");

    for (const [label, href] of [
      ["Panel de control", "/admin"],
      ["Productos", "/admin/products"],
      ["Categorías", "/admin/categories"],
      ["Cotizaciones", "/admin/quotes"],
      ["Clientes potenciales", "/admin/leads"],
      ["Inventario", "/admin/inventory"],
      ["Documentos", "/admin/documents"],
      ["Diseño del sitio", "/admin/design"],
      ["Usuarios", "/admin/users"],
      ["Configuración", "/admin/settings"],
    ] as const) {
      expect(within(nav).getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  });

  test("groups the navigation under Spanish headings", () => {
    const nav = renderSidebar("/admin");

    for (const group of ["Catálogo", "Operaciones", "Contenido", "Administración"]) {
      expect(within(nav).getByText(group)).toBeInTheDocument();
    }
  });

  test("marks the section matching the current route", () => {
    const nav = renderSidebar("/admin/products");

    expect(within(nav).getByRole("link", { name: "Productos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("keeps the section marked on its nested routes", () => {
    const nav = renderSidebar("/admin/products/abc-123");

    expect(within(nav).getByRole("link", { name: "Productos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("does not mark the dashboard active for every admin route", () => {
    const nav = renderSidebar("/admin/products");

    expect(within(nav).getByRole("link", { name: "Panel de control" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  test("marks the dashboard active on the admin index itself", () => {
    const nav = renderSidebar("/admin");

    expect(within(nav).getByRole("link", { name: "Panel de control" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

// Filtering the nav is a usability concern, not the security boundary — the pages guard
// themselves. It exists so nobody is shown a door that answers 404.
describe("AdminSidebar for a staff user", () => {
  test("shows the sections staff has permission to open", () => {
    const nav = renderSidebar("/admin", "staff");

    for (const label of [
      "Panel de control",
      "Productos",
      "Categorías",
      "Cotizaciones",
      "Clientes potenciales",
      "Inventario",
      "Documentos",
    ]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  test("hides the sections that would answer 404", () => {
    const nav = renderSidebar("/admin", "staff");

    for (const label of ["Diseño del sitio", "Configuración", "Usuarios"]) {
      expect(within(nav).queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
  });

  test("hides a group heading when staff can open none of its sections", () => {
    // Staff has no access to Users/Settings, so the whole "Administración" group disappears.
    const nav = renderSidebar("/admin", "staff");

    expect(within(nav).queryByText("Administración")).not.toBeInTheDocument();
  });

  test("keeps every section for an admin", () => {
    const nav = renderSidebar("/admin", "admin");

    for (const label of ["Diseño del sitio", "Configuración", "Usuarios"]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }
  });
});
