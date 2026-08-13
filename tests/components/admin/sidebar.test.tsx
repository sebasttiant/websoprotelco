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
      ["Gestión de stock", "/admin/inventory"],
      ["Documentación", "/admin/documents"],
      ["Apariencia", "/admin/design"],
      ["Usuarios", "/admin/users"],
      ["Configuración", "/admin/settings"],
    ] as const) {
      expect(within(nav).getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  });

  test("groups the navigation under Spanish headings", () => {
    const nav = renderSidebar("/admin");

    for (const group of ["Principal", "Inventario", "Diseño y sitio", "Administración"]) {
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

  // Movements nests under inventory, so plain prefix matching lights up both rows. Telling the
  // operator they are in two places at once is worse than telling them nothing.
  test("marks only the most specific section when one nests under another", () => {
    const nav = renderSidebar("/admin/inventory/movements");

    expect(within(nav).getByRole("link", { name: "Historial de movimientos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Gestión de stock" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  test("still marks the parent section on its own route", () => {
    const nav = renderSidebar("/admin/inventory");

    expect(within(nav).getByRole("link", { name: "Gestión de stock" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Historial de movimientos" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  test("does not mark the dashboard active for every admin route", () => {
    const nav = renderSidebar("/admin/products");

    expect(within(nav).getByRole("link", { name: "Panel de control" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  // Sign-out moved out of the top bar and into the sidebar, below the sections. It sits
  // OUTSIDE the <nav>, so it is looked up on the whole render rather than within it: a
  // destructive control does not belong among the navigation landmarks.
  test("offers sign-out below the sections rather than inside the navigation", () => {
    const nav = renderSidebar("/admin");

    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
    expect(within(nav).queryByRole("button", { name: "Cerrar sesión" })).not.toBeInTheDocument();
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
      "Gestión de stock",
      "Documentación",
    ]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  test("hides the sections that would answer 404", () => {
    const nav = renderSidebar("/admin", "staff");

    for (const label of ["Apariencia", "Configuración", "Usuarios"]) {
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

    for (const label of ["Apariencia", "Configuración", "Usuarios"]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }
  });
});

// The groups used to be bare divs with a styled paragraph on top, so a screen reader met one flat
// run of links with no way to tell where a group started or to skip past one. Naming each group as
// a region and promoting its title to a heading is what makes the structure navigable.
describe("AdminSidebar group structure", () => {
  test("exposes each visible group as a region carrying its own name", () => {
    const nav = renderSidebar("/admin");

    expect(
      within(nav)
        .getAllByRole("region")
        .map((region) => region.getAttribute("aria-label")),
    ).toEqual(["Principal", "Inventario", "Diseño y sitio", "Administración"]);
  });

  test("promotes each group title to a heading instead of a styled paragraph", () => {
    const nav = renderSidebar("/admin");

    expect(
      within(nav)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["Principal", "Inventario", "Diseño y sitio", "Administración"]);
  });

  test("keeps every link inside the region named for its group", () => {
    const nav = renderSidebar("/admin");
    const inventory = within(nav).getByRole("region", { name: "Inventario" });

    expect(within(inventory).getByRole("link", { name: "Gestión de stock" })).toBeInTheDocument();
    expect(within(inventory).queryByRole("link", { name: "Panel de control" })).not.toBeInTheDocument();
  });

  test("drops the region together with the group staff cannot open", () => {
    const nav = renderSidebar("/admin", "staff");

    expect(within(nav).queryByRole("region", { name: "Administración" })).not.toBeInTheDocument();
    expect(within(nav).getByRole("region", { name: "Principal" })).toBeInTheDocument();
  });
});
