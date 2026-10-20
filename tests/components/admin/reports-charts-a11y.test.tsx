import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { RevenueBars } from "@/components/admin/reports/revenue-bars";
import { StatusDonut } from "@/components/admin/reports/status-donut";
import { TrendBars } from "@/components/admin/reports/trend-bars";
import { formatCurrencyCents } from "@/lib/presentation";

describe("report charts text alternatives", () => {
  test("trend bars expose their values as a readable table outside the hidden chart", () => {
    const { container } = render(
      <TrendBars
        data={[
          { date: "2026-10-19", label: "19 oct", orders: 3, quotes: 1 },
          { date: "2026-10-20", label: "20 oct", orders: 0, quotes: 2 },
        ]}
      />,
    );

    const table = screen.getByRole("table");
    expect(table.closest('[aria-hidden="true"]')).toBeNull();
    expect(screen.getByText("Pedidos y cotizaciones por día")).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "19 oct" })).toBeTruthy();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  test("revenue bars expose month, formatted revenue and won orders", () => {
    render(
      <RevenueBars data={[{ month: "2026-09", revenueCents: 150_000_000, orderCount: 4 }]} />,
    );

    const table = screen.getByRole("table");
    expect(table.closest('[aria-hidden="true"]')).toBeNull();
    expect(screen.getByRole("rowheader", { name: "2026-09" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: formatCurrencyCents(150_000_000) })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "4" })).toBeTruthy();
  });

  test("status donut announces its total and keeps the chart decorative", () => {
    const { container } = render(
      <StatusDonut
        unitLabel="pedidos"
        data={[
          { status: "won", label: "Ganados", count: 3, percent: 60 },
          { status: "new", label: "Nuevos", count: 2, percent: 40 },
        ]}
      />,
    );

    expect(screen.getByText("Total: 5 pedidos")).toBeTruthy();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    // The visible legend already carries label + count + percent as text.
    expect(screen.getByText("3 · 60%")).toBeTruthy();
  });
});
