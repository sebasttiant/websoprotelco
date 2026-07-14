import { StatCard } from "@/components/admin/stat-card";
import { getProductsForAdmin } from "@/domains/catalog";
import { getLowStockProducts } from "@/domains/inventory";
import { getLeads } from "@/domains/leads";
import { getQuotes } from "@/domains/quote-order";
import { getCurrentUser } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  // The layout has already enforced admin:access, so this read is only for the greeting.
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
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Administration</p>
        <h1 className="text-3xl font-black text-brand-navy">Dashboard</h1>
        {user ? (
          <p className="mt-2 text-sm font-medium text-brand-muted">
            Signed in as <span className="font-black text-brand-navy">{user.email}</span> ({user.role})
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Products" value={products.total} href="/admin/products" hint="In the catalog" />
        <StatCard
          label="Open quotes"
          value={openQuotes}
          href="/admin/quotes"
          hint="Received or in review"
          alert
        />
        <StatCard label="Leads" value={leads.length} href="/admin/leads" hint="Captured so far" />
        <StatCard
          label="Low stock"
          value={lowStock.length}
          href="/admin/inventory"
          hint="At or below the threshold"
          alert
        />
      </div>
    </section>
  );
}
