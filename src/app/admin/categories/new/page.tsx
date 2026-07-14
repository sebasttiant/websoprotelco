import Link from "next/link";

import { createCategory, getCategoryOptions } from "@/domains/catalog";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

export default async function NewCategoryPage() {
  await requirePermission("catalog:write");
  const categories = await getCategoryOptions();
  const inputClass = "rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900";

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <Link href="/admin/categories" className="text-sm font-bold text-brand-blue">← Back to categories</Link>
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Catalog</p>
        <h1 className="text-3xl font-black text-slate-950">New category</h1>
      </div>
      <form action={createCategory as unknown as FormAction} className="grid gap-4 rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5">
        <label className="grid gap-2 text-sm font-bold text-slate-700">Name<input name="name" required className={inputClass} /></label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">Slug<input name="slug" required className={inputClass} /></label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">Parent<select name="parentId" defaultValue="" className={inputClass}><option value="">No parent</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <ImageUploadField name="imageUrl" label="Category image" />
        <label className="grid gap-2 text-sm font-bold text-slate-700">Display order<input name="displayOrder" type="number" min="0" defaultValue="0" className={inputClass} /></label>
        <button type="submit" className="rounded-full bg-brand-blue px-5 py-3 text-sm font-black text-white">Create category</button>
      </form>
    </section>
  );
}
