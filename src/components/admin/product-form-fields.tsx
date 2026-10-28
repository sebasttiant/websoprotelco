import { ImageUploadField } from "@/components/admin/image-upload-field";
import { SlugField } from "@/components/admin/slug-field";
import { adminInput } from "@/components/admin/ui";
import type { CategoryOption } from "@/domains/catalog";
import { centsToPesos } from "@/lib/money";

const inputClass = adminInput;

interface ProductFormFieldsProps {
  categories: CategoryOption[];
  defaults?: {
    name?: string;
    sku?: string;
    slug?: string;
    categoryId?: string;
    description?: string;
    priceCents?: number;
    promoPriceCents?: number | null;
    isFeatured?: boolean;
    currency?: string;
    stockQuantity?: number;
    brand?: string | null;
    imageUrl?: string | null;
    isActive?: boolean;
  };
}

export function ProductFormFields({ categories, defaults = {} }: ProductFormFieldsProps) {
  const pricePesos = defaults.priceCents !== undefined ? centsToPesos(defaults.priceCents) : 0;
  const promoPesos = defaults.promoPriceCents ? centsToPesos(defaults.promoPriceCents) : 0;

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.85fr)] lg:items-start lg:gap-8">
      <div className="grid min-w-0 gap-4">
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Nombre
          <input
            id="product-name"
            name="name"
            required
            defaultValue={defaults.name}
            className={inputClass}
          />
        </label>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">
            SKU
            <input name="sku" required defaultValue={defaults.sku} className={inputClass} />
          </label>
          <div className="min-w-0">
            <SlugField
              defaultName={defaults.name}
              defaultSlug={defaults.slug}
              inputClassName={inputClass}
            />
          </div>
        </div>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">
            Categoría
            <select name="categoryId" required defaultValue={defaults.categoryId} className={inputClass}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">
            Marca
            <input name="brand" defaultValue={defaults.brand ?? ""} className={inputClass} />
          </label>
        </div>

        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Descripción
          <textarea name="description" defaultValue={defaults.description} className={inputClass} rows={5} />
        </label>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700 sm:col-span-2 lg:col-span-1">
            Precio (pesos COP)
            <input
              name="pricePesos"
              type="text"
              inputMode="numeric"
              required
              defaultValue={pricePesos > 0 ? String(pricePesos) : ""}
              placeholder="Ej: 2500000"
              className={inputClass}
            />
            <span className="text-xs font-semibold text-slate-500">Valor en pesos, sin centavos.</span>
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">
            Moneda
            <input name="currency" defaultValue={defaults.currency ?? "COP"} maxLength={3} className={inputClass} />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">
            Stock
            <input
              name="stockQuantity"
              type="number"
              min="0"
              defaultValue={defaults.stockQuantity ?? 0}
              className={inputClass}
            />
          </label>
        </div>

        <div className="grid gap-4 rounded-xl border border-brand-line bg-brand-ice/60 p-4">
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Precio promocional (pesos COP)
            <input
              name="promoPricePesos"
              type="text"
              inputMode="numeric"
              defaultValue={promoPesos > 0 ? String(promoPesos) : ""}
              placeholder="Vacío = sin promoción"
              className={inputClass}
            />
            <span className="text-xs font-semibold text-slate-500">
              Si lo completás, ese es el precio que paga el cliente. Debe ser menor que el precio normal; dejalo vacío
              para quitar la promoción.
            </span>
          </label>
          <label className="flex flex-wrap items-start gap-3 text-sm font-bold text-slate-700">
            <input type="checkbox" name="isFeatured" defaultChecked={defaults.isFeatured ?? false} className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              Producto Top / destacado
              <span className="mt-1 block text-xs font-semibold text-slate-500">
                Aparece en “Promociones y destacados” de la home con insignia Top.
              </span>
            </span>
          </label>
        </div>
      </div>

      <aside className="grid min-w-0 gap-4 lg:sticky lg:top-4">
        <ImageUploadField name="imageUrl" label="Imagen del producto" defaultValue={defaults.imageUrl} />
        <label className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-line bg-white p-4 text-sm font-bold text-slate-700">
          <input type="checkbox" name="isActive" defaultChecked={defaults.isActive ?? true} className="h-5 w-5 shrink-0" />
          Visible en la tienda
        </label>
      </aside>
    </div>
  );
}
