import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductFormFields } from "@/components/admin/product-form-fields";
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
    <section className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/products" className="text-sm font-bold text-brand-blue">
        ← Volver a productos
      </Link>
      <div>
        <p className="text-[0.65rem] font-black uppercase tracking-widest text-brand-blue">Catálogo</p>
        <h1 className="text-2xl font-black tracking-tight text-brand-navy sm:text-3xl">Editar producto</h1>
        <p className="mt-2 text-sm font-medium text-brand-muted">{product.name}</p>
      </div>
      <form action={updateProduct as unknown as FormAction} className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm shadow-blue-950/5">
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
        <button type="submit" className="rounded-full bg-brand-blue px-5 py-3 text-sm font-black text-white transition hover:bg-brand-primary">
          Guardar cambios
        </button>
      </form>
    </section>
  );
}
