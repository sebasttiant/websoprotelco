import Link from "next/link";

import { ProductFormFields } from "@/components/admin/product-form-fields";
import {
  adminEyebrow,
  adminFormActions,
  adminFormCard,
  adminFormPage,
  adminLead,
  adminPrimaryBtn,
  adminTitle,
} from "@/components/admin/ui";
import { createProduct, getCategoryOptions } from "@/domains/catalog";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

export default async function NewProductPage() {
  await requirePermission("catalog:write");
  const categories = await getCategoryOptions();

  return (
    <section className={adminFormPage}>
      <Link href="/admin/products" className="inline-flex text-sm font-bold text-brand-blue">
        ← Volver a productos
      </Link>
      <div className="min-w-0">
        <p className={adminEyebrow}>Catálogo</p>
        <h1 className={adminTitle}>Nuevo producto</h1>
        <p className={adminLead}>
          Precio en pesos, slug automático e imagen opcional. Pensado para cargar sin complicaciones.
        </p>
      </div>
      <form action={createProduct as unknown as FormAction} className={`${adminFormCard} grid gap-6`}>
        <ProductFormFields categories={categories} />
        <div className={adminFormActions}>
          <button type="submit" className={`${adminPrimaryBtn} w-full sm:w-auto sm:min-w-[12rem]`}>
            Crear producto
          </button>
        </div>
      </form>
    </section>
  );
}
