import Link from "next/link";

import { createProduct } from "@/domains/catalog";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { query } from "@/server/db/pool";

export const dynamic = "force-dynamic";

interface CategoryOption {
  id: string;
  name: string;
}

type FormAction = (formData: FormData) => Promise<void>;

async function getCategories(): Promise<CategoryOption[]> {
  return query<CategoryOption>("SELECT id, name FROM categories ORDER BY display_order ASC, name ASC");
}

export default async function NewProductPage() {
  const categories = await getCategories();

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/products" className="text-sm font-bold text-brand-blue">← Back to products</Link>
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Catalog</p>
        <h1 className="text-3xl font-black text-slate-950">New product</h1>
      </div>
      <ProductForm action={createProduct as unknown as FormAction} categories={categories} submitLabel="Create product" />
    </section>
  );
}

function ProductForm({ action, categories, submitLabel }: { action: FormAction; categories: CategoryOption[]; submitLabel: string }) {
  return (
    <form action={action} className="grid gap-4 rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5">
      <ProductFields categories={categories} />
      <button type="submit" className="rounded-full bg-brand-blue px-5 py-3 text-sm font-black text-white">{submitLabel}</button>
    </form>
  );
}

function ProductFields({ categories }: { categories: CategoryOption[] }) {
  const inputClass = "rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900";
  return (
    <>
      <label className="grid gap-2 text-sm font-bold text-slate-700">Name<input name="name" required className={inputClass} /></label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-slate-700">SKU<input name="sku" required className={inputClass} /></label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">Slug<input name="slug" required className={inputClass} /></label>
      </div>
      <label className="grid gap-2 text-sm font-bold text-slate-700">Category<select name="categoryId" required className={inputClass}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className="grid gap-2 text-sm font-bold text-slate-700">Description<textarea name="description" className={inputClass} rows={4} /></label>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-bold text-slate-700">Price cents<input name="priceCents" type="number" min="0" defaultValue="0" className={inputClass} /></label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">Currency<input name="currency" defaultValue="COP" maxLength={3} className={inputClass} /></label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">Stock<input name="stockQuantity" type="number" min="0" defaultValue="0" className={inputClass} /></label>
      </div>
      <label className="grid gap-2 text-sm font-bold text-slate-700">Brand<input name="brand" className={inputClass} /></label>
      <ImageUploadField name="imageUrl" label="Product image" />
      <label className="flex items-center gap-3 text-sm font-bold text-slate-700"><input type="checkbox" name="isActive" defaultChecked className="h-5 w-5" /> Active</label>
    </>
  );
}
