import Link from "next/link";

import {
  adminEyebrow,
  adminFormActions,
  adminFormCard,
  adminFormPage,
  adminInput,
  adminPrimaryBtn,
  adminTitle,
} from "@/components/admin/ui";
import { createCategory, getCategoryOptions } from "@/domains/catalog";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

export default async function NewCategoryPage() {
  await requirePermission("catalog:write");
  const categories = await getCategoryOptions();

  return (
    <section className={adminFormPage}>
      <Link href="/admin/categories" className="inline-flex text-sm font-bold text-brand-blue">
        ← Volver a categorías
      </Link>
      <div className="min-w-0">
        <p className={adminEyebrow}>Catálogo</p>
        <h1 className={adminTitle}>Nueva categoría</h1>
      </div>
      <form action={createCategory as unknown as FormAction} className={`${adminFormCard} grid gap-5`}>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">
            Nombre
            <input name="name" required className={adminInput} />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">
            Slug
            <input name="slug" required className={adminInput} />
          </label>
        </div>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">
            Categoría padre
            <select name="parentId" defaultValue="" className={adminInput}>
              <option value="">Sin categoría padre</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">
            Orden de visualización
            <input name="displayOrder" type="number" min="0" defaultValue="0" className={adminInput} />
          </label>
        </div>
        <div className={adminFormActions}>
          <button type="submit" className={`${adminPrimaryBtn} w-full sm:w-auto sm:min-w-[12rem]`}>
            Crear categoría
          </button>
        </div>
      </form>
    </section>
  );
}
