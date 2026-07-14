import Link from "next/link";
import { notFound } from "next/navigation";

import { getCategoryByIdForAdmin, getCategoryOptionsExcluding, updateCategory } from "@/domains/catalog";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

interface EditCategoryPageProps {
  params: Promise<{ id: string }>;
}

type FormAction = (formData: FormData) => Promise<void>;

export default async function EditCategoryPage({ params }: EditCategoryPageProps) {
  await requirePermission("catalog:write");
  const { id } = await params;
  const [category, categories] = await Promise.all([getCategoryByIdForAdmin(id), getCategoryOptionsExcluding(id)]);

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
        <label className="grid gap-2 text-sm font-bold text-slate-700">Parent<select name="parentId" defaultValue={category.parentId ?? ""} className={inputClass}><option value="">No parent</option>{categories.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
        <ImageUploadField name="imageUrl" label="Category image" defaultValue={category.imageUrl} />
        <label className="grid gap-2 text-sm font-bold text-slate-700">Display order<input name="displayOrder" type="number" min="0" defaultValue={category.displayOrder} className={inputClass} /></label>
        <button type="submit" className="rounded-full bg-brand-blue px-5 py-3 text-sm font-black text-white">Update category</button>
      </form>
    </section>
  );
}
