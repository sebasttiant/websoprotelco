import Link from "next/link";
import { notFound } from "next/navigation";

import { ImageUploadField } from "@/components/admin/image-upload-field";
import { getCategoryOptions, getProductByIdForAdmin, updateProduct } from "@/domains/catalog";
import { isUuid } from "@/lib/uuid";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

type FormAction = (formData: FormData) => Promise<void>;

export default async function EditProductPage({ params }: EditProductPageProps) {
  await requirePermission("catalog:write");
  const { id } = await params;

  // Guard the uuid before it reaches the repository so a malformed id renders a clean
  // not-found instead of crashing the page with a Postgres uuid syntax error.
  if (!isUuid(id)) {
    notFound();
  }

  const [product, categories] = await Promise.all([getProductByIdForAdmin(id), getCategoryOptions()]);

  if (!product) {
    notFound();
  }

  const inputClass = "rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900";

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/products" className="text-sm font-bold text-brand-blue">← Volver a productos</Link>
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Catálogo</p>
        <h1 className="text-3xl font-black text-slate-950">Editar producto</h1>
      </div>
      <form action={updateProduct as unknown as FormAction} className="grid gap-4 rounded-[28px] bg-white p-6 shadow-xl shadow-blue-950/5">
        <input type="hidden" name="id" value={product.id} />
        <label className="grid gap-2 text-sm font-bold text-slate-700">Nombre<input name="name" required defaultValue={product.name} className={inputClass} /></label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-slate-700">SKU<input name="sku" required defaultValue={product.sku} className={inputClass} /></label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">Slug<input name="slug" required defaultValue={product.slug} className={inputClass} /></label>
        </div>
        <label className="grid gap-2 text-sm font-bold text-slate-700">Categoría<select name="categoryId" required defaultValue={product.categoryId} className={inputClass}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">Descripción<textarea name="description" defaultValue={product.description} className={inputClass} rows={4} /></label>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold text-slate-700">Precio (en centavos)<input name="priceCents" type="number" min="0" defaultValue={product.priceCents} className={inputClass} /></label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">Moneda<input name="currency" defaultValue={product.currency} maxLength={3} className={inputClass} /></label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">Stock<input name="stockQuantity" type="number" min="0" defaultValue={product.stockQuantity} className={inputClass} /></label>
        </div>
        <label className="grid gap-2 text-sm font-bold text-slate-700">Marca<input name="brand" defaultValue={product.brand ?? ""} className={inputClass} /></label>
        <ImageUploadField name="imageUrl" label="Imagen del producto" defaultValue={product.imageUrl} />
        <label className="flex items-center gap-3 text-sm font-bold text-slate-700"><input type="checkbox" name="isActive" defaultChecked={product.isActive} className="h-5 w-5" /> Activo</label>
        <button type="submit" className="rounded-full bg-brand-blue px-5 py-3 text-sm font-black text-white">Actualizar producto</button>
      </form>
    </section>
  );
}
