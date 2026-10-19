import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Minus, Pencil, Plus, Trash2, Upload } from "lucide-react";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { InitialAvatar } from "@/components/admin/initial-avatar";
import { SearchInput } from "@/components/admin/search-input";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  adminActions,
  adminChip,
  adminDarkBtn,
  adminEyebrow,
  adminFilterBar,
  adminHeaderRow,
  adminLead,
  adminPage,
  adminPrimaryBtn,
  adminSecondaryBtn,
  adminSelect,
  adminTitle,
} from "@/components/admin/ui";
import {
  deleteProduct,
  getProductsForAdmin,
  getSafeCatalogImageUrl,
  type ProductAdminSummary,
} from "@/domains/catalog";
import { recordStockMovement } from "@/domains/inventory";
import { hasPermission } from "@/server/auth/rbac";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

interface ProductsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function buildProductsHref(page: number, search: string, status: string, missingImage: boolean): string {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (status) params.set("status", status);
  if (missingImage) params.set("missingImage", "1");
  params.set("page", String(page));
  return `/admin/products?${params.toString()}`;
}

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency, minimumFractionDigits: 0 }).format(cents / 100);
}

function QuickStock({ productId, delta, label }: { productId: string; delta: 1 | -1; label: string }) {
  return (
    <form action={recordStockMovement as unknown as FormAction}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="movementType" value="adjustment" />
      <input type="hidden" name="quantity" value={String(delta)} />
      <input type="hidden" name="notes" value="Ajuste rápido desde productos" />
      <input type="hidden" name="returnTo" value="/admin/products" />
      <button
        type="submit"
        aria-label={label}
        className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-brand-blue hover:text-brand-blue"
      >
        {delta > 0 ? <Plus aria-hidden="true" className="h-3.5 w-3.5" /> : <Minus aria-hidden="true" className="h-3.5 w-3.5" />}
      </button>
    </form>
  );
}

export default async function AdminProductsPage({ searchParams }: ProductsPageProps) {
  const user = await requirePermission("catalog:read");
  const canWriteInventory = hasPermission(user.role, "inventory:write");
  const params = await searchParams;
  const search = firstParam(params.q).trim();
  const status = firstParam(params.status).trim();
  const missingImage = firstParam(params.missingImage) === "1";
  const page = Math.max(1, Number.parseInt(firstParam(params.page), 10) || 1);
  const { rows, totalPages } = await getProductsForAdmin({
    search: search || undefined,
    status: status === "active" || status === "inactive" ? status : undefined,
    missingImage: missingImage || undefined,
    page,
  });

  const columns: DataTableColumn<ProductAdminSummary>[] = [
    {
      key: "product",
      header: "Producto",
      render: (row) => {
        const imageUrl = getSafeCatalogImageUrl(row.imageUrl);
        return (
          <div className="flex items-center gap-3">
            {imageUrl ? (
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                <Image src={imageUrl} alt="" fill sizes="44px" className="object-contain p-0.5" />
              </div>
            ) : (
              <InitialAvatar name={row.name} seed={row.sku} />
            )}
            <div className="min-w-0">
              <p className="truncate font-black text-slate-950">{row.name}</p>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">SKU: {row.sku}</p>
            </div>
          </div>
        );
      },
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
    {
      key: "price",
      header: "Precio",
      render: (row) => <span className="font-black text-brand-blue">{formatCurrency(row.priceCents, row.currency)}</span>,
    },
    {
      key: "stock",
      header: "Stock",
      render: (row) =>
        canWriteInventory ? (
          <div className="flex items-center gap-1.5">
            <QuickStock productId={row.id} delta={-1} label={`Bajar stock de ${row.name}`} />
            <span className="min-w-8 text-center font-black text-slate-900">{row.stockQuantity}</span>
            <QuickStock productId={row.id} delta={1} label={`Subir stock de ${row.name}`} />
          </div>
        ) : (
          row.stockQuantity
        ),
    },
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
    <section className={adminPage}>
      <div className={adminHeaderRow}>
        <div className="min-w-0">
          <p className={adminEyebrow}>Catálogo</p>
          <h1 className={adminTitle}>Productos</h1>
          <p className={adminLead}>Miniaturas, stock rápido e importación CSV para catálogos grandes.</p>
        </div>
        <div className={adminActions}>
          <Link href="/admin/products/import" className={adminSecondaryBtn}>
            <Upload aria-hidden="true" className="h-4 w-4" />
            Importar CSV
          </Link>
          <Link href="/admin/products/new" className={adminPrimaryBtn}>
            Nuevo producto
          </Link>
        </div>
      </div>

      <form className={adminFilterBar}>
        <SearchInput defaultValue={search} placeholder="Buscar productos" />
        <select name="status" defaultValue={status} className={adminSelect}>
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>
        <label className={adminChip}>
          <input type="checkbox" name="missingImage" value="1" defaultChecked={missingImage} className="h-4 w-4" />
          Sin imagen
        </label>
        <button type="submit" className={adminDarkBtn}>
          Filtrar
        </button>
      </form>

      <DataTable
        rows={rows}
        columns={columns}
        emptyMessage="No se encontraron productos."
        page={page}
        totalPages={totalPages}
        pageHref={(nextPage) => buildProductsHref(nextPage, search, status, missingImage)}
      />
    </section>
  );
}
