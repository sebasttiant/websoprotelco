import Link from "next/link";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { deleteCategory, getCategoriesForAdmin, type CategoryAdminSummary } from "@/domains/catalog";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

export default async function AdminCategoriesPage() {
  await requirePermission("catalog:read");
  const rows = await getCategoriesForAdmin();
  const columns: DataTableColumn<CategoryAdminSummary>[] = [
    { key: "name", header: "Nombre", render: (row) => <div><p className="font-black text-slate-950">{row.name}</p><p className="text-xs font-bold text-slate-500">{row.slug}</p></div> },
    { key: "parent", header: "Categoría padre", render: (row) => row.parentName ?? "—" },
    { key: "order", header: "Orden", render: (row) => row.displayOrder },
    { key: "image", header: "Imagen", render: (row) => row.imageUrl ? <span className="text-brand-blue">Configurada</span> : "—" },
    { key: "actions", header: "Acciones", render: (row) => <div className="flex gap-2"><Link href={`/admin/categories/${row.id}`} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700">Editar</Link><form action={deleteCategory as unknown as FormAction}><input type="hidden" name="id" value={row.id} /><ConfirmDialog message={`¿Eliminar la categoría "${row.name}"? Esta acción no se puede deshacer.`}>Eliminar</ConfirmDialog></form></div> },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Catálogo</p>
          <h1 className="text-3xl font-black text-slate-950">Categorías</h1>
        </div>
        <Link href="/admin/categories/new" className="rounded-full bg-brand-blue px-5 py-3 text-sm font-black text-white">Nueva categoría</Link>
      </div>
      <DataTable rows={rows} columns={columns} emptyMessage="No se encontraron categorías." />
    </section>
  );
}
