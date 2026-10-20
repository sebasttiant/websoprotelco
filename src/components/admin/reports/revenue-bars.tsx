"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MonthlyRevenue } from "@/domains/reports";
import { formatCurrencyCents } from "@/lib/presentation";

import { ChartDataTable } from "./chart-data-table";
import { ChartMount } from "./chart-mount";
import { CHART_CHROME, SERIES_COLORS } from "./palette";

type RevenueBarsProps = {
  data: MonthlyRevenue[];
  emptyMessage?: string;
};

export function RevenueBars({
  data,
  emptyMessage = "Todavía no hay ingresos ganados registrados.",
}: RevenueBarsProps) {
  const hasData = data.some((row) => row.revenueCents > 0);

  if (!hasData) {
    return (
      <div className="flex h-64 items-center justify-center text-sm font-medium text-brand-muted">
        {emptyMessage}
      </div>
    );
  }

  const chartData = data.map((row) => ({
    ...row,
    revenue: row.revenueCents / 100,
  }));

  return (
    <>
      <div aria-hidden="true">
        <ChartMount className="h-72 w-full min-w-0">
          <div className="h-72 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke={CHART_CHROME.grid} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: CHART_CHROME.tick }}
              tickLine={false}
              axisLine={{ stroke: CHART_CHROME.axisLine }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: CHART_CHROME.tick }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(value: number) =>
                value >= 1_000_000
                  ? `${Math.round(value / 1_000_000)}M`
                  : value >= 1000
                    ? `${Math.round(value / 1000)}k`
                    : String(value)
              }
            />
            <Tooltip
              cursor={{ fill: CHART_CHROME.cursor, fillOpacity: 0.06 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as MonthlyRevenue & { revenue: number };
                return (
                  <div className="rounded-xl border border-brand-line bg-white px-3 py-2 text-xs shadow-md">
                    <p className="font-black text-brand-navy">{label}</p>
                    <p className="font-bold text-emerald-700">{formatCurrencyCents(row.revenueCents)}</p>
                    <p className="font-medium text-brand-muted">{row.orderCount} pedidos ganados</p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="revenue"
              name="Ingresos"
              fill={SERIES_COLORS.revenue}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
          </div>
        </ChartMount>
      </div>
      <ChartDataTable
        caption="Ingresos mensuales y pedidos ganados por mes"
        headers={["Mes", "Ingresos", "Pedidos ganados"]}
        rows={data.map((row) => [
          row.month,
          formatCurrencyCents(row.revenueCents),
          row.orderCount,
        ])}
      />
    </>
  );
}
