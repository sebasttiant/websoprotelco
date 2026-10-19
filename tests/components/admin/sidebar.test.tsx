import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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

interface MatchMediaController {
  enterDesktop: () => void;
  listenerCount: () => number;
}

function mockMatchMedia(): MatchMediaController {
  let matches = false;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQuery = {
    get matches() {
      return matches;
    },
    media: "(min-width: 768px)",
    onchange: null,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject | null) => {
      if (typeof listener === "function") {
        listeners.add(listener as unknown as (event: MediaQueryListEvent) => void);
      }
    },
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject | null) => {
      if (typeof listener === "function") {
        listeners.delete(listener as unknown as (event: MediaQueryListEvent) => void);
      }
    },
    addListener: (listener: ((event: MediaQueryListEvent) => void) | null) => {
      if (listener) listeners.add(listener);
    },
    removeListener: (listener: ((event: MediaQueryListEvent) => void) | null) => {
      if (listener) listeners.delete(listener);
    },
    dispatchEvent: () => true,
  } as unknown as MediaQueryList;

  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => mediaQuery),
  );

  return {
    enterDesktop: () => {
      matches = true;
      for (const listener of listeners) {
        listener({ matches, media: "(min-width: 768px)" } as MediaQueryListEvent);
      }
    },
    listenerCount: () => listeners.size,
  };
}

let mediaQuery: MatchMediaController;

beforeEach(() => {
  mediaQuery = mockMatchMedia();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  document.body.style.overflow = "";
});

describe("AdminSidebar", () => {
  test("links every admin section in Spanish", () => {
    const nav = renderSidebar("/admin");

    for (const [label, href] of [
      ["Panel de control", "/admin"],
      ["Reportes", "/admin/reports"],
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
      "Reportes",
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

describe("AdminSidebar mobile navigation", () => {
  test("opens an accessible drawer with the permitted active section", async () => {
    renderSidebar("/admin/inventory/movements", "staff");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Abrir menú" }));

    const drawer = screen.getByRole("dialog", { name: "Menú" });
    expect(drawer).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar menú" })).toHaveFocus();
    expect(within(drawer).getByRole("link", { name: "Historial de movimientos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(drawer).queryByRole("link", { name: "Usuarios" })).not.toBeInTheDocument();
  });

  test("closes on Escape and returns focus to the menu trigger", async () => {
    renderSidebar("/admin");
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "Abrir menú" });

    await user.click(trigger);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Menú" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  test("keeps keyboard focus inside the open drawer", async () => {
    renderSidebar("/admin");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Abrir menú" }));
    await user.keyboard("{Shift>}{Tab}{/Shift}");

    const drawer = screen.getByRole("dialog", { name: "Menú" });
    expect(within(drawer).getByRole("link", { name: "Configuración" })).toHaveFocus();
  });

  test("wraps forward Tab from the final control to the close button", async () => {
    renderSidebar("/admin");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Abrir menú" }));
    const drawer = screen.getByRole("dialog", { name: "Menú" });
    within(drawer).getByRole("link", { name: "Configuración" }).focus();

    await user.tab();

    expect(screen.getByRole("button", { name: "Cerrar menú" })).toHaveFocus();
  });

  test("closes when the backdrop is activated", async () => {
    renderSidebar("/admin");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Abrir menú" }));
    await user.click(screen.getByRole("button", { name: "Cerrar menú al hacer clic fuera" }));

    expect(screen.queryByRole("dialog", { name: "Menú" })).not.toBeInTheDocument();
  });

  test("cleans up the open drawer when the viewport reaches desktop", async () => {
    renderSidebar("/admin");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Abrir menú" }));
    expect(document.body).toHaveStyle({ overflow: "hidden" });

    mediaQuery.enterDesktop();

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Menú" })).not.toBeInTheDocument();
      expect(document.body.style.overflow).toBe("");
    });
  });

  test("restores body scrolling and deactivates global listeners on unmount", async () => {
    mockUsePathname.mockReturnValue("/admin");
    document.body.style.overflow = "clip";
    const { unmount } = render(<AdminSidebar role="admin" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Abrir menú" }));
    expect(document.body.style.overflow).toBe("hidden");
    expect(mediaQuery.listenerCount()).toBe(1);

    unmount();

    const escape = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    window.dispatchEvent(escape);

    expect(document.body.style.overflow).toBe("clip");
    expect(escape.defaultPrevented).toBe(false);
    expect(mediaQuery.listenerCount()).toBe(0);
  });

  test("closes before following an admin navigation link", async () => {
    renderSidebar("/admin");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Abrir menú" }));
    const drawer = screen.getByRole("dialog", { name: "Menú" });
    await user.click(within(drawer).getByRole("link", { name: "Productos" }));

    expect(screen.queryByRole("dialog", { name: "Menú" })).not.toBeInTheDocument();
  });
});
