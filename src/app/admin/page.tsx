import Link from "next/link";
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
} from "lucide-react";

import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatCurrencyCents, formatDate, quoteStatusLabel, roleLabel } from "@/lib/presentation";
import { getProductsForAdmin } from "@/domains/catalog";
import { getLowStockProducts } from "@/domains/inventory";
import { getLeads } from "@/domains/leads";
import { getQuotes } from "@/domains/quote-order";
import { getCurrentUser } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

const RECENT_ORDERS_LIMIT = 5;
const STOCK_ALERTS_LIMIT = 5;

export default async function AdminDashboardPage() {
  // Deliberately session-only: this is the admin landing page, and every count below maps to a
  // read that both roles already hold (catalog, quote, leads, inventory). Guarding it on any one
  // permission would be arbitrary, and guarding it on admin:access would 404 staff on the page
  // they land on. Anything added here that staff may NOT read needs its own permission check.
  // Quotes and orders are fetched as two SCOPED reads, never as one unfiltered list split in
  // memory. The legacy dashboard queried the shared table with no kind filter and reported
  // quotes as orders — its "Pedidos recientes" listed the very rows of its quotes screen.
  const [user, products, quotes, orders, leads, lowStock] = await Promise.all([
    getCurrentUser(),
    getProductsForAdmin({}),
    getQuotes({ kind: "quote" }),
    getQuotes({ kind: "order" }),
    getLeads(),
    getLowStockProducts(),
  ]);

  // A quote still needs someone once it is received or under review; quoted, won, lost and
  // cancelled have all been dealt with.
  const openQuotes = quotes.filter(
    (quote) => quote.status === "received" || quote.status === "in_review",
  ).length;

  const pendingOrders = orders.filter(
    (order) => order.status === "received" || order.status === "in_review",
  ).length;

  // Revenue counts WON orders only — the ones that actually closed. A pending order is not
  // income, and including it would inflate the headline number the business steers by.
  //
  // An order whose total is unknown (a line without a price snapshot) is excluded from the sum
  // and counted here instead, so the figure is never quietly short by an invisible amount.
  const wonOrders = orders.filter((order) => order.status === "won");
  const revenueCents = wonOrders.reduce((total, order) => total + (order.totalCents ?? 0), 0);
  const wonOrdersWithoutTotal = wonOrders.filter((order) => order.totalCents === null).length;

  // getQuotes already returns newest first, so the head of the list is the most recent activity.
  const recentOrders = orders.slice(0, RECENT_ORDERS_LIMIT);
  const stockAlerts = lowStock.slice(0, STOCK_ALERTS_LIMIT);

  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Administración</p>
        <h1 className="text-3xl font-black text-brand-navy">Panel de control</h1>
        {user ? (
          <p className="mt-2 text-sm font-medium text-brand-muted">
            Sesión iniciada como <span className="font-black text-brand-navy">{user.email}</span> ({roleLabel(user.role)})
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ingresos"
          value={revenueCents}
          display={formatCurrencyCents(revenueCents)}
          href="/admin/orders"
          icon={TrendingUp}
          tone="positive"
          hint={
            wonOrdersWithoutTotal > 0
              ? `Pedidos ganados · ${wonOrdersWithoutTotal} sin total registrado`
              : "Pedidos ganados"
          }
        />
        <StatCard label="Pedidos" value={orders.length} href="/admin/orders" icon={ShoppingBag} tone="brand" hint="Registrados en total" />
        <StatCard
          label="Pedidos pendientes"
          value={pendingOrders}
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

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section aria-labelledby="recent-orders-heading" className="rounded-[28px] border border-brand-line bg-white p-6 shadow-xl shadow-blue-950/5">
          <div className="flex items-center justify-between gap-4">
            <h2 id="recent-orders-heading" className="text-lg font-black text-brand-navy">
              Pedidos recientes
            </h2>
            <Link href="/admin/orders" className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-brand-blue hover:underline">
              Ver todos
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>

          {recentOrders.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
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
                      <td className="py-3 pr-4">
                        <Link href="/admin/orders" className="font-black text-brand-blue hover:underline">
                          {order.reference}
                        </Link>
                        <span className="block text-xs font-medium text-brand-muted">{formatDate(order.createdAt)}</span>
                      </td>
                      <td className="py-3 pr-4 font-bold text-brand-navy">{order.contactName}</td>
                      <td className="py-3 pr-4 font-black text-brand-navy">{formatCurrencyCents(order.totalCents)}</td>
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

        <div className="space-y-6">
          <section aria-labelledby="quick-actions-heading" className="rounded-[28px] border border-brand-line bg-white p-6 shadow-xl shadow-blue-950/5">
            <h2 id="quick-actions-heading" className="text-lg font-black text-brand-navy">
              Acciones rápidas
            </h2>
            <div className="mt-4 space-y-3">
              <Link
                href="/admin/products/new"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-blue px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-brand-primary"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nuevo producto
              </Link>
              <Link
                href="/admin/categories"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-line px-6 py-3 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-accent"
              >
                <FolderTree aria-hidden="true" className="h-4 w-4" />
                Gestionar categorías
              </Link>
              <Link
                href="/admin/settings"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-line px-6 py-3 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-accent"
              >
                <Settings aria-hidden="true" className="h-4 w-4" />
                Configuración
              </Link>
            </div>
          </section>

          <section aria-labelledby="stock-alerts-heading" className="rounded-[28px] border border-brand-line bg-white p-6 shadow-xl shadow-blue-950/5">
            <h2 id="stock-alerts-heading" className="flex items-center gap-2 text-lg font-black text-brand-navy">
              <AlertTriangle aria-hidden="true" className="h-5 w-5 text-red-500" />
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

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Productos" value={products.total} href="/admin/products" icon={Package} tone="brand" hint="En el catálogo" />
        <StatCard
          label="Cotizaciones abiertas"
          value={openQuotes}
          href="/admin/quotes"
          icon={ClipboardList}
          tone="warning"
          hint="Recibidas o en revisión"
          alert
        />
        <StatCard label="Clientes potenciales" value={leads.length} href="/admin/leads" icon={ShoppingBag} tone="neutral" hint="Capturados hasta ahora" />
      </div>
    </section>
  );
}
