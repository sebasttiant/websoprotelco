import Link from "next/link";
import { notFound } from "next/navigation";

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

  return (
    <section className={adminFormPage}>
      <Link href="/admin/products" className="inline-flex text-sm font-bold text-brand-blue">
        ← Volver a productos
      </Link>
      <div className="min-w-0">
        <p className={adminEyebrow}>Catálogo</p>
        <h1 className={adminTitle}>Editar producto</h1>
        <p className={adminLead}>{product.name}</p>
      </div>
      <form action={updateProduct as unknown as FormAction} className={`${adminFormCard} grid gap-6`}>
        <input type="hidden" name="id" value={product.id} />
        <ProductFormFields
          categories={categories}
          defaults={{
            name: product.name,
            sku: product.sku,
            slug: product.slug,
            categoryId: product.categoryId,
            description: product.description,
            priceCents: product.priceCents,
            promoPriceCents: product.promoPriceCents,
            isFeatured: product.isFeatured,
            currency: product.currency,
            stockQuantity: product.stockQuantity,
            brand: product.brand,
            imageUrl: product.imageUrl,
            isActive: product.isActive,
          }}
        />
        <div className={adminFormActions}>
          <button type="submit" className={`${adminPrimaryBtn} w-full sm:w-auto sm:min-w-[12rem]`}>
            Guardar cambios
          </button>
        </div>
      </form>
    </section>
  );
}
