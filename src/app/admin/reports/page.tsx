import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ClipboardList,
  Package,
  ShoppingBag,
  TrendingUp,
  UsersRound,
} from "lucide-react";

import {
  ReportExportActions,
  ReportExportPanel,
} from "@/components/admin/reports/report-export-panel";
import { RevenueBars } from "@/components/admin/reports/revenue-bars";
import { StatusDonut } from "@/components/admin/reports/status-donut";
import { TrendBars } from "@/components/admin/reports/trend-bars";
import { StatCard } from "@/components/admin/stat-card";
import {
  adminCard,
  adminEyebrow,
  adminHeaderRow,
  adminLead,
  adminPage,
  adminTitle,
} from "@/components/admin/ui";
import {
  getFullAdminReport,
  isReportRange,
  REPORT_RANGES,
  type ReportRange,
} from "@/domains/reports";
import { formatCurrencyCents, formatDate } from "@/lib/presentation";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

interface ReportsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

const RANGE_LABELS: Record<ReportRange, string> = {
  "7": "7 días",
  "30": "30 días",
  "90": "90 días",
  all: "Todo",
};

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-base font-black tracking-tight text-brand-navy">{children}</h2>;
}

function ChartCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`${adminCard} min-w-0 space-y-4`}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black text-brand-navy">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function AdminReportsPage({ searchParams }: ReportsPageProps) {
  await requirePermission("quote:read");

  const params = await searchParams;
  const rawRange = firstParam(params.range).trim();
  const range: ReportRange = isReportRange(rawRange) ? rawRange : "30";
  const report = await getFullAdminReport(range);
  const rangeLabel = RANGE_LABELS[range];

  return (
    <section className={adminPage}>
      <div className={adminHeaderRow}>
        <div className="min-w-0">
          <p className={adminEyebrow}>Análisis</p>
          <h1 className={adminTitle}>Reportes</h1>
          <p className={adminLead}>
            KPIs, distribución y tendencia. Exportá por etapas en Excel, CSV o PDF.
            {report.fromIso ? (
              <>
                {" "}
                Período: {formatDate(report.fromIso)} → {formatDate(report.toIso)}.
              </>
            ) : (
              <> Desde el inicio hasta {formatDate(report.toIso)}.</>
            )}
          </p>
        </div>
        <ReportExportActions range={range} />
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2 print:hidden">
        <span className="text-[0.65rem] font-black uppercase tracking-widest text-brand-muted">
          Período
        </span>
        {REPORT_RANGES.map((option) => {
          const active = option === range;
          return (
            <Link
              key={option}
              href={`/admin/reports?range=${option}`}
              className={
                active
                  ? "rounded-full bg-brand-navy px-3.5 py-2 text-xs font-black uppercase tracking-widest text-white"
                  : "rounded-full border border-brand-line bg-white px-3.5 py-2 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-blue"
              }
            >
              {RANGE_LABELS[option]}
            </Link>
          );
        })}
      </div>

      {/* Commercial KPIs */}
      <div className="space-y-3">
        <SectionTitle>Comercial</SectionTitle>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Ingresos (ganados)"
            value={report.commercial.revenueCents}
            display={formatCurrencyCents(report.commercial.revenueCents)}
            href="/admin/orders?status=won"
            icon={TrendingUp}
            tone="positive"
            hint={
              report.commercial.wonWithoutTotal > 0
                ? `${report.commercial.wonOrders} ganados · ${report.commercial.wonWithoutTotal} sin total`
                : `${report.commercial.wonOrders} pedidos ganados`
            }
          />
          <StatCard
            label="Pedidos"
            value={report.commercial.orders}
            href="/admin/orders"
            icon={ShoppingBag}
            tone="brand"
            hint={`${report.commercial.pendingOrders} pendientes`}
            alert={report.commercial.pendingOrders > 0}
          />
          <StatCard
            label="Cotizaciones"
            value={report.commercial.quotes}
            href="/admin/quotes"
            icon={ClipboardList}
            tone="warning"
            hint={`${report.commercial.openQuotes} abiertas`}
            alert={report.commercial.openQuotes > 0}
          />
          <StatCard
            label="Conversión"
            value={report.commercial.conversionPercent}
            display={`${report.commercial.conversionPercent}%`}
            href="/admin/orders"
            icon={TrendingUp}
            tone="neutral"
            hint="Ganados / (ganados + perdidos)"
          />
        </div>
      </div>

      {/* Status donuts */}
      <div className="space-y-3">
        <SectionTitle>Distribución por estado ({rangeLabel})</SectionTitle>
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <ChartCard title="Pedidos">
            <StatusDonut data={report.ordersSlices} unitLabel="pedidos" />
          </ChartCard>
          <ChartCard title="Cotizaciones">
            <StatusDonut data={report.quotesSlices} unitLabel="cotizaciones" />
          </ChartCard>
        </div>
      </div>

      {/* Daily trend */}
      <div className="space-y-3">
        <SectionTitle>Tendencia de creación por día</SectionTitle>
        <ChartCard title={`Pedidos vs cotizaciones (${rangeLabel})`}>
          <TrendBars data={report.dailyTrend} />
        </ChartCard>
      </div>

      {/* Revenue */}
      <div className="space-y-3">
        <SectionTitle>Ingresos</SectionTitle>
        <ChartCard title="Ingresos mensuales (últimos 6 meses)">
          <RevenueBars data={report.monthlyRevenue} />
        </ChartCard>
      </div>

      {/* Catalog + leads KPIs */}
      <div className="space-y-3">
        <SectionTitle>Catálogo y leads</SectionTitle>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Productos"
            value={report.catalog.total}
            href="/admin/products"
            icon={Package}
            tone="brand"
            hint={`${report.catalog.active} activos · ${report.catalog.inactive} inactivos`}
          />
          <StatCard
            label="Sin imagen"
            value={report.catalog.missingImage}
            href="/admin/products?missingImage=1"
            icon={Package}
            tone="warning"
            hint="Falta miniatura"
            alert={report.catalog.missingImage > 0}
          />
          <StatCard
            label="Stock bajo / sin stock"
            value={report.catalog.lowStock + report.catalog.outOfStock}
            href="/admin/inventory"
            icon={AlertTriangle}
            tone="danger"
            hint={`${report.catalog.outOfStock} sin stock · ${report.catalog.lowStock} bajos`}
            alert
          />
          <StatCard
            label="Leads"
            value={report.leadTotal}
            href="/admin/leads"
            icon={UsersRound}
            tone="neutral"
            hint="En el período"
          />
        </div>

        <div className={`${adminCard} min-w-0`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-black text-brand-navy">Valor estimado del inventario activo</h3>
              <p className="mt-1 text-xs font-medium text-brand-muted">
                Precio × stock actual (solo productos activos). No es contabilidad formal.
              </p>
            </div>
            <p className="shrink-0 text-2xl font-black text-brand-navy">
              {formatCurrencyCents(report.catalog.catalogValueCents)}
            </p>
          </div>
        </div>
      </div>

      {/* More donuts + table */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <ChartCard title="Productos por categoría">
          <StatusDonut data={report.categorySlices} unitLabel="productos" />
        </ChartCard>
        <ChartCard title="Top productos (pedidos ganados)">
          {report.topProducts.length === 0 ? (
            <p className="py-10 text-center text-sm font-medium text-brand-muted">
              Sin ventas ganadas en el período.
            </p>
          ) : (
            <div className="max-w-full overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[28rem] text-sm">
                <thead className="text-left text-[0.65rem] font-black uppercase tracking-widest text-slate-500">
                  <tr className="border-b border-slate-100">
                    <th className="py-2 pr-3">Producto</th>
                    <th className="py-2 pr-3">Cant.</th>
                    <th className="py-2">Ingresos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.topProducts.map((row) => (
                    <tr key={`${row.productId ?? "x"}-${row.name}`}>
                      <td className="max-w-[14rem] truncate py-2.5 pr-3 font-bold text-slate-900">
                        {row.name}
                      </td>
                      <td className="py-2.5 pr-3 font-black text-brand-navy">{row.quantity}</td>
                      <td className="py-2.5 font-bold text-slate-700">
                        {formatCurrencyCents(row.revenueCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <ChartCard title={`Leads por estado (${rangeLabel})`}>
          <StatusDonut data={report.leadsSlices} unitLabel="leads" />
        </ChartCard>
        <ChartCard title={`Leads por origen (${rangeLabel})`}>
          <StatusDonut data={report.leadSourceSlices} unitLabel="leads" />
        </ChartCard>
      </div>

      <ReportExportPanel range={range} />

      <p className="text-xs font-medium text-brand-muted print:hidden">
        ¿Necesitás el detalle operativo?{" "}
        <Link href="/admin/orders" className="font-black text-brand-blue hover:underline">
          Pedidos
        </Link>
        {" · "}
        <Link href="/admin/quotes" className="font-black text-brand-blue hover:underline">
          Cotizaciones
        </Link>
        {" · "}
        <Link href="/admin/inventory" className="font-black text-brand-blue hover:underline">
          Stock
        </Link>
      </p>
    </section>
  );
}
