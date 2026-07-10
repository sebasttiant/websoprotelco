import Link from "next/link";
import { notFound } from "next/navigation";

import { updateCategory } from "@/app/admin/actions";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { query } from "@/server/db/pool";

export const dynamic = "force-dynamic";

interface EditCategoryPageProps {
  params: Promise<{ id: string }>;
}

type FormAction = (formData: FormData) => Promise<void>;

interface CategoryRow {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  image_url: string | null;
  display_order: number;
}

interface CategoryOption {
  id: string;
  name: string;
}

async function getCategory(id: string): Promise<CategoryRow | null> {
  const rows = await query<CategoryRow>("SELECT id, parent_id, slug, name, image_url, display_order FROM categories WHERE id = $1 LIMIT 1", [id]);
  return rows[0] ?? null;
}

async function getCategories(id: string): Promise<CategoryOption[]> {
  return query<CategoryOption>("SELECT id, name FROM categories WHERE id <> $1 ORDER BY display_order ASC, name ASC", [id]);
}

export default async function EditCategoryPage({ params }: EditCategoryPageProps) {
  const { id } = await params;
  const [category, categories] = await Promise.all([getCategory(id), getCategories(id)]);

  if (!category) {
    notFound();
  }

  const inputClass = "rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900";

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <Link href="/admin/categories" className="text-sm font-bold text-brand-blue">← Back to categories</Link>
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Catalog</p>
        <h1 className="text-3xl font-black text-slate-950">Edit category</h1>
      </div>
      <form action={updateCategory as unknown as FormAction} className="grid gap-4 rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5">
        <input type="hidden" name="id" value={category.id} />
        <label className="grid gap-2 text-sm font-bold text-slate-700">Name<input name="name" required defaultValue={category.name} className={inputClass} /></label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">Slug<input name="slug" required defaultValue={category.slug} className={inputClass} /></label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">Parent<select name="parentId" defaultValue={category.parent_id ?? ""} className={inputClass}><option value="">No parent</option>{categories.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
        <ImageUploadField name="imageUrl" label="Category image" defaultValue={category.image_url} />
        <label className="grid gap-2 text-sm font-bold text-slate-700">Display order<input name="displayOrder" type="number" min="0" defaultValue={category.display_order} className={inputClass} /></label>
        <button type="submit" className="rounded-full bg-brand-blue px-5 py-3 text-sm font-black text-white">Update category</button>
      </form>
    </section>
  );
}
