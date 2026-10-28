import Link from "next/link";
import { notFound } from "next/navigation";

import {
  adminEyebrow,
  adminFormActions,
  adminFormCard,
  adminFormPage,
  adminInput,
  adminPrimaryBtn,
  adminTitle,
} from "@/components/admin/ui";
import { getCategoryByIdForAdmin, getCategoryOptionsExcluding, updateCategory } from "@/domains/catalog";
import { isUuid } from "@/lib/uuid";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

interface EditCategoryPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}

type FormAction = (formData: FormData) => Promise<void>;

export default async function EditCategoryPage({ params, searchParams }: EditCategoryPageProps) {
  await requirePermission("catalog:write");
  const { id } = await params;

  // Guard the uuid before it reaches the repository so a malformed id renders a clean
  // not-found instead of crashing the page with a Postgres uuid syntax error.
  if (!isUuid(id)) {
    notFound();
  }

  const [category, categories] = await Promise.all([getCategoryByIdForAdmin(id), getCategoryOptionsExcluding(id)]);
  const error = (await searchParams)?.error;

  if (!category) {
    notFound();
  }

  return (
    <section className={adminFormPage}>
      <Link href="/admin/categories" className="inline-flex text-sm font-bold text-brand-blue">
        ← Volver a categorías
      </Link>
      <div className="min-w-0">
        <p className={adminEyebrow}>Catálogo</p>
        <h1 className={adminTitle}>Editar categoría</h1>
      </div>
      {error ? (
        <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">
          No se pudo actualizar la categoría. Revisá los datos e intentá de nuevo.
        </p>
      ) : null}
      <form action={updateCategory as unknown as FormAction} className={`${adminFormCard} grid gap-5`}>
        <input type="hidden" name="id" value={category.id} />
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">
            Nombre
            <input name="name" required defaultValue={category.name} className={adminInput} />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">
            Slug
            <input name="slug" required defaultValue={category.slug} className={adminInput} />
          </label>
        </div>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">
            Categoría padre
            <select name="parentId" defaultValue={category.parentId ?? ""} className={adminInput}>
              <option value="">Sin categoría padre</option>
              {categories.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">
            Orden de visualización
            <input
              name="displayOrder"
              type="number"
              min="0"
              defaultValue={category.displayOrder}
              className={adminInput}
            />
          </label>
        </div>
        <div className={adminFormActions}>
          <button type="submit" className={`${adminPrimaryBtn} w-full sm:w-auto sm:min-w-[12rem]`}>
            Actualizar categoría
          </button>
        </div>
      </form>
    </section>
  );
}
