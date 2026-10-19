import Link from "next/link";

import { importProductsCsv } from "@/domains/catalog";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

export default async function ImportProductsPage() {
  await requirePermission("catalog:write");

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/products" className="text-sm font-bold text-brand-blue">
        ← Volver a productos
      </Link>
      <div>
        <p className="text-[0.65rem] font-black uppercase tracking-widest text-brand-blue">Catálogo</p>
        <h1 className="text-2xl font-black tracking-tight text-brand-navy sm:text-3xl">Importar productos CSV</h1>
        <p className="mt-2 text-sm font-medium text-brand-muted">
          Ideal para cargar cientos o miles de referencias. Si el SKU ya existe, se actualiza.
        </p>
      </div>

      <div className="rounded-2xl border border-brand-line bg-white p-6 shadow-sm shadow-blue-950/5">
        <h2 className="text-lg font-black text-brand-navy">Columnas esperadas</h2>
        <p className="mt-2 text-sm font-medium text-brand-muted">
          La primera fila es el encabezado. Obligatorio: <code className="rounded bg-brand-ice px-1">sku</code>,{" "}
          <code className="rounded bg-brand-ice px-1">nombre</code>,{" "}
          <code className="rounded bg-brand-ice px-1">categoria</code>,{" "}
          <code className="rounded bg-brand-ice px-1">precio</code> (pesos COP).
        </p>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-brand-navy p-4 text-xs font-medium leading-6 text-brand-accent-soft">
{`sku,nombre,categoria,precio,stock,marca,descripcion,activo
CNV-01,Conversor de medios SM,Conversores,250000,10,SOPROTELCO,Conversión Ethernet a fibra,1
FUS-01,Fusionadora Pro X1,Fusionadoras,4500000,3,SOPROTELCO,Empalmes de precisión,1`}
        </pre>
        <p className="mt-3 text-xs font-semibold text-slate-500">
          La categoría debe existir antes en el panel. El precio va en pesos enteros (sin centavos). activo: 1/0.
        </p>
      </div>

      <form
        action={importProductsCsv as unknown as FormAction}
        encType="multipart/form-data"
        className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm shadow-blue-950/5"
      >
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Archivo CSV
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="rounded-2xl border border-dashed border-brand-line bg-brand-ice px-4 py-8 text-sm font-medium file:mr-4 file:rounded-full file:border-0 file:bg-brand-blue file:px-4 file:py-2 file:text-xs file:font-black file:uppercase file:tracking-widest file:text-white"
          />
        </label>
        <button type="submit" className="rounded-full bg-brand-blue px-5 py-3 text-sm font-black text-white transition hover:bg-brand-primary">
          Importar catálogo
        </button>
      </form>
    </section>
  );
}
