import Link from "next/link";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { InitialAvatar } from "@/components/admin/initial-avatar";
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
    {
      key: "product",
      header: "Producto",
      render: (row) => (
        <div className="flex items-center gap-3">
          {/* Keyed to the SKU: two products in the same category still get distinct colours. */}
          <InitialAvatar name={row.name} seed={row.sku} />
          <div className="min-w-0">
            <p className="truncate font-black text-slate-950">{row.name}</p>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">SKU: {row.sku}</p>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Categoría",
      render: (row) =>
        row.categoryName ? (
          <span className="inline-flex rounded-full bg-brand-ice px-3 py-1 text-xs font-black uppercase tracking-wide text-brand-navy">
            {row.categoryName}
          </span>
        ) : (
          <span className="text-xs font-bold text-slate-400">Sin categoría</span>
        ),
    },
    { key: "brand", header: "Marca", render: (row) => row.brand ?? "—" },
    { key: "price", header: "Precio", render: (row) => <span className="font-black text-brand-blue">{formatCurrency(row.priceCents, row.currency)}</span> },
    { key: "stock", header: "Stock", render: (row) => row.stockQuantity },
    { key: "status", header: "Estado", render: (row) => <StatusBadge status={row.isActive ? "active" : "inactive"} /> },
    {
      key: "actions",
      header: "Acciones",
      render: (row) => (
        <div className="flex items-center gap-1">
          <Link
            href={`/producto/${row.slug}`}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`Ver "${row.name}" en la tienda`}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-brand-ice hover:text-brand-blue"
          >
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </Link>
          <Link
            href={`/admin/products/${row.id}`}
            aria-label={`Editar "${row.name}"`}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-brand-ice hover:text-brand-blue"
          >
            <Pencil aria-hidden="true" className="h-4 w-4" />
          </Link>
          <form action={deleteProduct as unknown as FormAction}>
            <input type="hidden" name="id" value={row.id} />
            <ConfirmDialog
              message={`¿Eliminar el producto "${row.name}"? Esta acción no se puede deshacer.`}
              triggerClassName="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">Eliminar “{row.name}”</span>
            </ConfirmDialog>
          </form>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Catálogo</p>
          <h1 className="text-3xl font-black text-slate-950">Productos</h1>
        </div>
        <Link href="/admin/products/new" className="rounded-full bg-brand-blue px-5 py-3 text-sm font-black text-white">Nuevo producto</Link>
      </div>

      <form className="grid gap-3 rounded-[28px] bg-white p-4 shadow-xl shadow-blue-950/5 md:grid-cols-[1fr_180px_auto]">
        <SearchInput defaultValue={search} placeholder="Buscar productos" />
        <select name="status" defaultValue={status} className="rounded-full border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>
        <button type="submit" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white">Filtrar</button>
      </form>

      <DataTable rows={rows} columns={columns} emptyMessage="No se encontraron productos." page={page} totalPages={totalPages} pageHref={(nextPage) => buildProductsHref(nextPage, search, status)} />
    </section>
  );
}
