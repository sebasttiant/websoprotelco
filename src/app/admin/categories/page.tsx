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
    { key: "name", header: "Name", render: (row) => <div><p className="font-black text-slate-950">{row.name}</p><p className="text-xs font-bold text-slate-500">{row.slug}</p></div> },
    { key: "parent", header: "Parent", render: (row) => row.parentName ?? "—" },
    { key: "order", header: "Order", render: (row) => row.displayOrder },
    { key: "image", header: "Image", render: (row) => row.imageUrl ? <span className="text-brand-blue">Configured</span> : "—" },
    { key: "actions", header: "Actions", render: (row) => <div className="flex gap-2"><Link href={`/admin/categories/${row.id}`} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700">Edit</Link><form action={deleteCategory as unknown as FormAction}><input type="hidden" name="id" value={row.id} /><ConfirmDialog message={`Delete ${row.name}?`}>Delete</ConfirmDialog></form></div> },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Catalog</p>
          <h1 className="text-3xl font-black text-slate-950">Categories</h1>
        </div>
        <Link href="/admin/categories/new" className="rounded-full bg-brand-blue px-5 py-3 text-sm font-black text-white">New category</Link>
      </div>
      <DataTable rows={rows} columns={columns} emptyMessage="No categories found." />
    </section>
  );
}
