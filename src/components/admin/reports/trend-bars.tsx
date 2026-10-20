"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DailyTrendPoint } from "@/domains/reports";

import { ChartDataTable } from "./chart-data-table";
import { ChartMount } from "./chart-mount";
import { CHART_CHROME, SERIES_COLORS } from "./palette";

type TrendBarsProps = {
  data: DailyTrendPoint[];
  emptyMessage?: string;
};

export function TrendBars({
  data,
  emptyMessage = "Sin actividad en este período.",
}: TrendBarsProps) {
  const hasData = data.some((point) => point.orders > 0 || point.quotes > 0);

  if (!hasData) {
    return (
      <div className="flex h-64 items-center justify-center text-sm font-medium text-brand-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <div aria-hidden="true">
        <ChartMount className="h-72 w-full min-w-0">
          <div className="h-72 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke={CHART_CHROME.grid} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: CHART_CHROME.tick }}
              tickLine={false}
              axisLine={{ stroke: CHART_CHROME.axisLine }}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: CHART_CHROME.tick }}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <Tooltip
              cursor={{ fill: CHART_CHROME.cursor, fillOpacity: 0.06 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0]?.payload as DailyTrendPoint;
                return (
                  <div className="rounded-xl border border-brand-line bg-white px-3 py-2 text-xs shadow-md">
                    <p className="font-black text-brand-navy">{label}</p>
                    <p style={{ color: SERIES_COLORS.orders }} className="font-bold">
                      Pedidos: {point.orders}
                    </p>
                    <p style={{ color: SERIES_COLORS.quotes }} className="font-bold">
                      Cotizaciones: {point.quotes}
                    </p>
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              formatter={(value) => (value === "orders" ? "Pedidos" : "Cotizaciones")}
            />
            <Bar
              dataKey="orders"
              name="orders"
              fill={SERIES_COLORS.orders}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="quotes"
              name="quotes"
              fill={SERIES_COLORS.quotes}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
          </div>
        </ChartMount>
      </div>
      <ChartDataTable
        caption="Pedidos y cotizaciones por día"
        headers={["Día", "Pedidos", "Cotizaciones"]}
        rows={data.map((point) => [point.label, point.orders, point.quotes])}
      />
    </>
  );
}
