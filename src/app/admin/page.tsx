import { StatCard } from "@/components/admin/stat-card";
import { roleLabel } from "@/lib/presentation";
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
  const [user, products, quotes, leads, lowStock] = await Promise.all([
    getCurrentUser(),
    getProductsForAdmin({}),
    getQuotes(),
    getLeads(),
    getLowStockProducts(),
  ]);

  // A quote still needs someone once it is received or under review; quoted, won, lost and
  // cancelled have all been dealt with.
  const openQuotes = quotes.filter(
    (quote) => quote.status === "received" || quote.status === "in_review",
  ).length;

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
        <StatCard label="Productos" value={products.total} href="/admin/products" hint="En el catálogo" />
        <StatCard
          label="Cotizaciones abiertas"
          value={openQuotes}
          href="/admin/quotes"
          hint="Recibidas o en revisión"
          alert
        />
        <StatCard label="Clientes potenciales" value={leads.length} href="/admin/leads" hint="Capturados hasta ahora" />
        <StatCard
          label="Stock bajo"
          value={lowStock.length}
          href="/admin/inventory"
          hint="En o bajo el umbral"
          alert
        />
      </div>
    </section>
  );
}
