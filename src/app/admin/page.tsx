import { StatCard } from "@/components/admin/stat-card";
import { formatCurrencyCents, roleLabel } from "@/lib/presentation";
import { getProductsForAdmin } from "@/domains/catalog";
import { getLowStockProducts } from "@/domains/inventory";
import { getLeads } from "@/domains/leads";
import { getQuotes } from "@/domains/quote-order";
import { getCurrentUser } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

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
          hint={
            wonOrdersWithoutTotal > 0
              ? `Pedidos ganados · ${wonOrdersWithoutTotal} sin total registrado`
              : "Pedidos ganados"
          }
        />
        <StatCard label="Pedidos" value={orders.length} href="/admin/orders" hint="Registrados en total" />
        <StatCard
          label="Pedidos pendientes"
          value={pendingOrders}
          href="/admin/orders"
          hint="Recibidos o en revisión"
          alert
        />
        <StatCard
          label="Stock bajo"
          value={lowStock.length}
          href="/admin/inventory"
          hint="En o bajo el umbral"
          alert
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Productos" value={products.total} href="/admin/products" hint="En el catálogo" />
        <StatCard
          label="Cotizaciones abiertas"
          value={openQuotes}
          href="/admin/quotes"
          hint="Recibidas o en revisión"
          alert
        />
        <StatCard label="Clientes potenciales" value={leads.length} href="/admin/leads" hint="Capturados hasta ahora" />
      </div>
    </section>
  );
}
