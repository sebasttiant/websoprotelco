"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { StatusSlice } from "@/domains/reports";

import { ChartMount } from "./chart-mount";
import { colorForStatus } from "./palette";

type StatusDonutProps = {
  data: StatusSlice[];
  unitLabel: string;
  emptyMessage?: string;
};

export function StatusDonut({
  data,
  unitLabel,
  emptyMessage = "Sin registros en este período.",
}: StatusDonutProps) {
  const total = data.reduce((sum, slice) => sum + slice.count, 0);

  if (total === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm font-medium text-brand-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ChartMount className="flex h-56 items-center justify-center text-sm font-medium text-brand-muted">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative mx-auto h-52 w-full max-w-[15rem] shrink-0 sm:mx-0 sm:h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="label"
                innerRadius="62%"
                outerRadius="90%"
                paddingAngle={2}
                strokeWidth={0}
                isAnimationActive={false}
              >
                {data.map((slice, index) => (
                  <Cell key={slice.status} fill={colorForStatus(slice.status, index)} />
                ))}
              </Pie>
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const slice = payload[0]?.payload as StatusSlice;
                  return (
                    <div className="rounded-xl border border-brand-line bg-white px-3 py-2 text-xs shadow-md">
                      <p className="font-black text-brand-navy">{slice.label}</p>
                      <p className="font-medium text-brand-muted">
                        {slice.count} · {slice.percent}%
                      </p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black leading-none text-brand-navy">{total}</span>
            <span className="mt-0.5 text-[0.65rem] font-bold uppercase tracking-widest text-brand-muted">
              {unitLabel}
            </span>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-2">
          {data.map((slice, index) => (
            <li key={slice.status} className="flex min-w-0 items-center gap-2 text-sm">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: colorForStatus(slice.status, index) }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate font-bold text-slate-700">{slice.label}</span>
              <span className="shrink-0 tabular-nums text-xs font-medium text-brand-muted">
                {slice.count} · {slice.percent}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartMount>
  );
}
