import Link from "next/link";
import { notFound } from "next/navigation";

import { updateProduct } from "@/app/admin/actions";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { query } from "@/server/db/pool";

export const dynamic = "force-dynamic";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

type FormAction = (formData: FormData) => Promise<void>;

interface CategoryOption {
  id: string;
  name: string;
}

interface ProductRow {
  id: string;
  category_id: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  price_cents: string;
  currency: string;
  image_url: string | null;
  brand: string | null;
  stock_quantity: number;
  is_active: boolean;
}

async function getCategories(): Promise<CategoryOption[]> {
  return query<CategoryOption>("SELECT id, name FROM categories ORDER BY display_order ASC, name ASC");
}

async function getProduct(id: string): Promise<ProductRow | null> {
  const rows = await query<ProductRow>(
    `SELECT id, category_id, sku, slug, name, description, price_cents, currency, image_url, brand, stock_quantity, is_active
     FROM products
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const [product, categories] = await Promise.all([getProduct(id), getCategories()]);

  if (!product) {
    notFound();
  }

  const inputClass = "rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900";

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/products" className="text-sm font-bold text-brand-blue">← Back to products</Link>
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Catalog</p>
        <h1 className="text-3xl font-black text-slate-950">Edit product</h1>
      </div>
      <form action={updateProduct as unknown as FormAction} className="grid gap-4 rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5">
        <input type="hidden" name="id" value={product.id} />
        <label className="grid gap-2 text-sm font-bold text-slate-700">Name<input name="name" required defaultValue={product.name} className={inputClass} /></label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-slate-700">SKU<input name="sku" required defaultValue={product.sku} className={inputClass} /></label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">Slug<input name="slug" required defaultValue={product.slug} className={inputClass} /></label>
        </div>
        <label className="grid gap-2 text-sm font-bold text-slate-700">Category<select name="categoryId" required defaultValue={product.category_id} className={inputClass}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">Description<textarea name="description" defaultValue={product.description} className={inputClass} rows={4} /></label>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold text-slate-700">Price cents<input name="priceCents" type="number" min="0" defaultValue={product.price_cents} className={inputClass} /></label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">Currency<input name="currency" defaultValue={product.currency} maxLength={3} className={inputClass} /></label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">Stock<input name="stockQuantity" type="number" min="0" defaultValue={product.stock_quantity} className={inputClass} /></label>
        </div>
        <label className="grid gap-2 text-sm font-bold text-slate-700">Brand<input name="brand" defaultValue={product.brand ?? ""} className={inputClass} /></label>
        <ImageUploadField name="imageUrl" label="Product image" defaultValue={product.image_url} />
        <label className="flex items-center gap-3 text-sm font-bold text-slate-700"><input type="checkbox" name="isActive" defaultChecked={product.is_active} className="h-5 w-5" /> Active</label>
        <button type="submit" className="rounded-full bg-brand-blue px-5 py-3 text-sm font-black text-white">Update product</button>
      </form>
    </section>
  );
}
