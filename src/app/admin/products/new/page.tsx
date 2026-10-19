import Link from "next/link";

import { ProductFormFields } from "@/components/admin/product-form-fields";
import { createProduct, getCategoryOptions } from "@/domains/catalog";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

export default async function NewProductPage() {
  await requirePermission("catalog:write");
  const categories = await getCategoryOptions();

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/products" className="text-sm font-bold text-brand-blue">
        ← Volver a productos
      </Link>
      <div>
        <p className="text-[0.65rem] font-black uppercase tracking-widest text-brand-blue">Catálogo</p>
        <h1 className="text-2xl font-black tracking-tight text-brand-navy sm:text-3xl">Nuevo producto</h1>
        <p className="mt-2 text-sm font-medium text-brand-muted">
          Precio en pesos, slug automático e imagen opcional. Pensado para cargar sin complicaciones.
        </p>
      </div>
      <form action={createProduct as unknown as FormAction} className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm shadow-blue-950/5">
        <ProductFormFields categories={categories} />
        <button type="submit" className="rounded-full bg-brand-blue px-5 py-3 text-sm font-black text-white transition hover:bg-brand-primary">
          Crear producto
        </button>
      </form>
    </section>
  );
}
