import Link from "next/link";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { SearchInput } from "@/components/admin/search-input";
import { StatusBadge } from "@/components/admin/status-badge";
import { deleteProduct } from "@/app/admin/actions";
import { query } from "@/server/db/pool";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

type FormAction = (formData: FormData) => Promise<void>;

interface ProductsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface ProductRow {
  id: string;
  sku: string;
  slug: string;
  name: string;
  brand: string | null;
  price_cents: string;
  currency: string;
  stock_quantity: number;
  is_active: boolean;
  category_name: string | null;
}

interface CountRow {
  count: string;
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

async function getProducts(search: string, status: string, page: number): Promise<{ rows: ProductRow[]; total: number }> {
  const where: string[] = [];
  const values: unknown[] = [];

  if (search) {
    values.push(`%${search}%`);
    where.push(`(p.name ILIKE $${values.length} OR p.sku ILIKE $${values.length} OR p.slug ILIKE $${values.length})`);
  }

  if (status === "active" || status === "inactive") {
    values.push(status === "active");
    where.push(`p.is_active = $${values.length}`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const countRows = await query<CountRow>(`SELECT count(*) FROM products p ${whereSql}`, values);

  values.push(PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const rows = await query<ProductRow>(
    `SELECT p.id, p.sku, p.slug, p.name, p.brand, p.price_cents, p.currency, p.stock_quantity, p.is_active, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ${whereSql}
     ORDER BY p.updated_at DESC, p.name ASC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );

  return { rows, total: Number.parseInt(countRows[0]?.count ?? "0", 10) };
}

function formatCurrency(cents: string, currency: string): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency, minimumFractionDigits: 0 }).format(Number.parseInt(cents, 10) / 100);
}

export default async function AdminProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const search = firstParam(params.q).trim();
  const status = firstParam(params.status).trim();
  const page = Math.max(1, Number.parseInt(firstParam(params.page), 10) || 1);
  const { rows, total } = await getProducts(search, status, page);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: DataTableColumn<ProductRow>[] = [
    { key: "product", header: "Product", render: (row) => <div><p className="font-black text-slate-950">{row.name}</p><p className="text-xs font-bold text-slate-500">{row.sku} · {row.slug}</p></div> },
    { key: "category", header: "Category", render: (row) => row.category_name ?? "Uncategorized" },
    { key: "brand", header: "Brand", render: (row) => row.brand ?? "—" },
    { key: "price", header: "Price", render: (row) => formatCurrency(row.price_cents, row.currency) },
    { key: "stock", header: "Stock", render: (row) => row.stock_quantity },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.is_active ? "active" : "inactive"} /> },
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
