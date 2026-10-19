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
    currency?: string;
    stockQuantity?: number;
    brand?: string | null;
    imageUrl?: string | null;
    isActive?: boolean;
  };
}

export function ProductFormFields({ categories, defaults = {} }: ProductFormFieldsProps) {
  const pricePesos = defaults.priceCents !== undefined ? centsToPesos(defaults.priceCents) : 0;

  return (
    <>
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

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          SKU
          <input name="sku" required defaultValue={defaults.sku} className={inputClass} />
        </label>
        <SlugField
          defaultName={defaults.name}
          defaultSlug={defaults.slug}
          inputClassName={inputClass}
        />
      </div>

      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Categoría
        <select name="categoryId" required defaultValue={defaults.categoryId} className={inputClass}>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Descripción
        <textarea name="description" defaultValue={defaults.description} className={inputClass} rows={4} />
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-bold text-slate-700">
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
          <span className="text-xs font-semibold text-slate-500">Escribí el valor en pesos, sin centavos. Ejemplo: 2500000</span>
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Moneda
          <input name="currency" defaultValue={defaults.currency ?? "COP"} maxLength={3} className={inputClass} />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
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

      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Marca
        <input name="brand" defaultValue={defaults.brand ?? ""} className={inputClass} />
      </label>

      <ImageUploadField name="imageUrl" label="Imagen del producto" defaultValue={defaults.imageUrl} />

      <label className="flex items-center gap-3 text-sm font-bold text-slate-700">
        <input type="checkbox" name="isActive" defaultChecked={defaults.isActive ?? true} className="h-5 w-5" />
        Visible en la tienda
      </label>
    </>
  );
}
