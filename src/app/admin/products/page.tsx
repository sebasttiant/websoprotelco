import Link from "next/link";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { SearchInput } from "@/components/admin/search-input";
import { StatusBadge } from "@/components/admin/status-badge";
import { deleteProduct, getProductsForAdmin, type ProductAdminSummary } from "@/domains/catalog";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

interface ProductsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function buildProductsHref(page: number, search: string, status: string): string {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (status) params.set("status", status);
  params.set("page", String(page));
  return `/admin/products?${params.toString()}`;
}

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency, minimumFractionDigits: 0 }).format(cents / 100);
}

export default async function AdminProductsPage({ searchParams }: ProductsPageProps) {
  await requirePermission("catalog:read");
  const params = await searchParams;
  const search = firstParam(params.q).trim();
  const status = firstParam(params.status).trim();
  const page = Math.max(1, Number.parseInt(firstParam(params.page), 10) || 1);
  const { rows, totalPages } = await getProductsForAdmin({
    search: search || undefined,
    status: status === "active" || status === "inactive" ? status : undefined,
    page,
  });

  const columns: DataTableColumn<ProductAdminSummary>[] = [
    { key: "product", header: "Product", render: (row) => <div><p className="font-black text-slate-950">{row.name}</p><p className="text-xs font-bold text-slate-500">{row.sku} · {row.slug}</p></div> },
    { key: "category", header: "Category", render: (row) => row.categoryName ?? "Uncategorized" },
    { key: "brand", header: "Brand", render: (row) => row.brand ?? "—" },
    { key: "price", header: "Price", render: (row) => formatCurrency(row.priceCents, row.currency) },
    { key: "stock", header: "Stock", render: (row) => row.stockQuantity },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.isActive ? "active" : "inactive"} /> },
    { key: "actions", header: "Actions", render: (row) => <div className="flex gap-2"><Link href={`/admin/products/${row.id}`} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700">Edit</Link><form action={deleteProduct as unknown as FormAction}><input type="hidden" name="id" value={row.id} /><ConfirmDialog message={`Delete ${row.name}?`}>Delete</ConfirmDialog></form></div> },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Catalog</p>
          <h1 className="text-3xl font-black text-slate-950">Products</h1>
        </div>
        <Link href="/admin/products/new" className="rounded-full bg-brand-blue px-5 py-3 text-sm font-black text-white">New product</Link>
      </div>

      <form className="grid gap-3 rounded-[28px] bg-white p-4 shadow-xl shadow-blue-950/5 md:grid-cols-[1fr_180px_auto]">
        <SearchInput defaultValue={search} placeholder="Search products" />
        <select name="status" defaultValue={status} className="rounded-full border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button type="submit" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white">Filter</button>
      </form>

      <DataTable rows={rows} columns={columns} emptyMessage="No products found." page={page} totalPages={totalPages} pageHref={(nextPage) => buildProductsHref(nextPage, search, status)} />
    </section>
  );
}
