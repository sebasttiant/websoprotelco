import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { DataTable, type DataTableColumn } from "@/components/admin/data-table";

interface Row {
  name: string;
}

const COLUMNS: DataTableColumn<Row>[] = [
  { key: "name", header: "Nombre", render: (row) => row.name },
];

const ROWS: Row[] = [{ name: "Alfa" }, { name: "Beta" }, { name: "Gamma" }];

describe("DataTable presentation", () => {
  test("body rows alternate and respond to hover so long lists stay scannable", () => {
    render(<DataTable rows={ROWS} columns={COLUMNS} emptyMessage="Sin filas" />);

    // odd:/even: variants live on every row; the browser resolves the striping by position.
    const [first, second] = screen.getAllByRole("row").slice(1);
    expect(first.className).toContain("hover:bg-brand-ice");
    expect(second.className).toContain("even:bg-brand-ice/40");
    expect(second.className).toContain("odd:bg-white");
  });

  test("empty state shows the message with room to read it", () => {
    render(<DataTable rows={[]} columns={COLUMNS} emptyMessage="No hay pedidos aún." />);

    const cell = screen.getByText("No hay pedidos aún.");
    expect(cell.className).toContain("py-12");
  });

  test("pagination marks the current page for assistive tech", () => {
    render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        emptyMessage="Sin filas"
        page={2}
        totalPages={3}
        pageHref={(page) => `/admin/orders?page=${page}`}
      />,
    );

    const indicator = screen.getByText("Página 2 de 3");
    expect(indicator.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Página anterior" }).getAttribute("href")).toBe(
      "/admin/orders?page=1",
    );
    expect(screen.getByRole("link", { name: "Página siguiente" }).getAttribute("href")).toBe(
      "/admin/orders?page=3",
    );
  });

  test("header cells stay scoped columns", () => {
    render(<DataTable rows={ROWS} columns={COLUMNS} emptyMessage="Sin filas" />);

    const header = screen.getByRole("columnheader", { name: "Nombre" });
    expect(header.getAttribute("scope")).toBe("col");
    expect(within(header).getByText("Nombre")).toBeTruthy();
  });
});
