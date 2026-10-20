import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  ClipboardList,
  FolderTree,
  Package,
  Plus,
  Settings,
  ShoppingBag,
  TrendingUp,
  Upload,
} from "lucide-react";

import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatCurrencyCents, formatDate, quoteStatusLabel, roleLabel } from "@/lib/presentation";
import { countAllProducts } from "@/domains/catalog";
import { getLowStockProducts } from "@/domains/inventory";
import { countLeads } from "@/domains/leads";
import { getQuoteDashboardCounts, getQuotes } from "@/domains/quote-order";
import { requirePermission } from "@/server/auth/guards";
import { hasPermission, type Permission } from "@/server/auth/rbac";

export const dynamic = "force-dynamic";

const RECENT_ORDERS_LIMIT = 5;
const STOCK_ALERTS_LIMIT = 5;

// The dashboard aggregates commerce, catalog, leads and inventory, so the session must hold the
// read permission of every domain it queries. quote:read goes through requirePermission (it
// also covers the signed-out redirect); the rest fail closed the same way, 404 rather than a
// partial dashboard.
const DASHBOARD_PRIMARY_PERMISSION: Permission = "quote:read";
const DASHBOARD_SECTION_PERMISSIONS: readonly Permission[] = ["catalog:read", "leads:read", "inventory:read"];

export default async function AdminDashboardPage() {
  // Authorize before any query is issued: a customer session is valid but holds no permission.
  const user = await requirePermission(DASHBOARD_PRIMARY_PERMISSION);

  if (!DASHBOARD_SECTION_PERMISSIONS.every((permission) => hasPermission(user.role, permission))) {
    notFound();
  }

  // Counts come from SQL aggregates so the dashboard stays light with thousands of products
  // and commercial rows. Recent orders and stock alerts stay bounded by LIMIT.
  const [productCount, commercial, leadCount, recentOrders, lowStock] = await Promise.all([
    countAllProducts(),
    getQuoteDashboardCounts(),
    countLeads(),
    getQuotes({ kind: "order", limit: RECENT_ORDERS_LIMIT }),
    getLowStockProducts(),
  ]);

  const stockAlerts = lowStock.slice(0, STOCK_ALERTS_LIMIT);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-brand-navy via-brand-primary to-brand-blue px-5 py-5 text-white shadow-md shadow-blue-950/15 sm:px-6 sm:py-6">
        <p className="text-[0.65rem] font-black uppercase tracking-widest text-brand-accent">Administración</p>
        <h1 className="mt-1.5 text-2xl font-black tracking-tight sm:text-3xl">Panel de control</h1>
        <p className="mt-1.5 text-sm font-medium text-blue-100/85">
          Sesión: <span className="font-black text-white">{user.email}</span> ({roleLabel(user.role)})
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ingresos"
          value={commercial.revenueCents}
          display={formatCurrencyCents(commercial.revenueCents)}
          href="/admin/orders"
          icon={TrendingUp}
          tone="positive"
          hint={
            commercial.wonWithoutTotal > 0
              ? `Pedidos ganados · ${commercial.wonWithoutTotal} sin total registrado`
              : "Pedidos ganados"
          }
        />
        <StatCard label="Pedidos" value={commercial.totalOrders} href="/admin/orders" icon={ShoppingBag} tone="brand" hint="Registrados en total" />
        <StatCard
          label="Pedidos pendientes"
          value={commercial.pendingOrders}
          href="/admin/orders"
          icon={ClipboardList}
          tone="warning"
          hint="Recibidos o en revisión"
          alert
        />
        <StatCard
          label="Stock bajo"
          value={lowStock.length}
          href="/admin/inventory"
          icon={AlertTriangle}
          tone="danger"
          hint="En o bajo el umbral"
          alert
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section
          aria-labelledby="recent-orders-heading"
          className="min-w-0 overflow-hidden rounded-2xl border border-brand-line bg-white p-4 shadow-sm shadow-blue-950/5 sm:p-5"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 id="recent-orders-heading" className="text-base font-black text-brand-navy">
              Pedidos recientes
            </h2>
            <Link
              href="/admin/orders"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-black uppercase tracking-widest text-brand-blue hover:underline"
            >
              Ver todos
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>

          {recentOrders.length > 0 ? (
            <div className="mt-4 max-w-full overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[28rem] text-sm">
                <thead className="text-left text-xs font-black uppercase tracking-widest text-brand-muted">
                  <tr className="border-b border-brand-line">
                    <th className="py-3 pr-4">Referencia</th>
                    <th className="py-3 pr-4">Cliente</th>
                    <th className="py-3 pr-4">Total</th>
                    <th className="py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-line/60">
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="max-w-[9rem] py-3 pr-4">
                        <Link href="/admin/orders" className="truncate font-black text-brand-blue hover:underline">
                          {order.reference}
                        </Link>
                        <span className="block text-xs font-medium text-brand-muted">{formatDate(order.createdAt)}</span>
                      </td>
                      <td className="max-w-[8rem] truncate py-3 pr-4 font-bold text-brand-navy">{order.contactName}</td>
                      <td className="whitespace-nowrap py-3 pr-4 font-black text-brand-navy">
                        {formatCurrencyCents(order.totalCents)}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={order.status} label={quoteStatusLabel(order.status)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-6 rounded-2xl bg-brand-ice p-6 text-center text-sm font-bold text-brand-muted">
              Aún no hay pedidos registrados.
            </p>
          )}
        </section>

        <div className="space-y-4">
          <section aria-labelledby="quick-actions-heading" className="rounded-2xl border border-brand-line bg-white p-4 shadow-sm shadow-blue-950/5 sm:p-5">
            <h2 id="quick-actions-heading" className="text-base font-black text-brand-navy">
              Acciones rápidas
            </h2>
            <div className="mt-3 space-y-2">
              <Link
                href="/admin/products/new"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-blue px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-brand-primary"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nuevo producto
              </Link>
              <Link
                href="/admin/products/import"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-line px-5 py-2.5 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-accent"
              >
                <Upload aria-hidden="true" className="h-4 w-4" />
                Importar CSV
              </Link>
              <Link
                href="/admin/categories"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-line px-5 py-2.5 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-accent"
              >
                <FolderTree aria-hidden="true" className="h-4 w-4" />
                Gestionar categorías
              </Link>
              <Link
                href="/admin/reports"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-line px-5 py-2.5 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-accent"
              >
                <TrendingUp aria-hidden="true" className="h-4 w-4" />
                Ver reportes
              </Link>
              <Link
                href="/admin/settings"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-line px-5 py-2.5 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-accent"
              >
                <Settings aria-hidden="true" className="h-4 w-4" />
                Configuración
              </Link>
            </div>
          </section>

          <section aria-labelledby="stock-alerts-heading" className="rounded-2xl border border-brand-line bg-white p-4 shadow-sm shadow-blue-950/5 sm:p-5">
            <h2 id="stock-alerts-heading" className="flex items-center gap-2 text-base font-black text-brand-navy">
              <AlertTriangle aria-hidden="true" className="h-4 w-4 text-red-500" />
              Alertas de stock
            </h2>
            {stockAlerts.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {stockAlerts.map((item) => (
                  <li key={item.productId} className="flex items-center justify-between gap-3">
                    <Link href="/admin/inventory" className="min-w-0 flex-1 truncate font-bold text-brand-navy hover:text-brand-blue">
                      {item.name}
                    </Link>
                    <span className="shrink-0 rounded-full bg-red-500/10 px-3 py-1 text-xs font-black text-red-600">
                      {item.currentStock} uds
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm font-bold text-emerald-600">✓ No hay alertas de stock bajo.</p>
            )}
          </section>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Productos" value={productCount} href="/admin/products" icon={Package} tone="brand" hint="En el catálogo" />
        <StatCard
          label="Cotizaciones abiertas"
          value={commercial.openQuotes}
          href="/admin/quotes"
          icon={ClipboardList}
          tone="warning"
          hint="Recibidas o en revisión"
          alert
        />
        <StatCard label="Clientes potenciales" value={leadCount} href="/admin/leads" icon={ShoppingBag} tone="neutral" hint="Capturados hasta ahora" />
      </div>
    </section>
  );
}
