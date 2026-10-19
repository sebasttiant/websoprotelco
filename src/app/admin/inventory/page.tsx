import Link from "next/link";
import { History, Minus, Plus, Search } from "lucide-react";

import { movementTypeLabel } from "@/lib/presentation";
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  getStockLevels,
  MOVEMENT_TYPES,
  recordStockMovement,
  type ProductStock,
} from "@/domains/inventory";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

interface InventoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parseThreshold(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_LOW_STOCK_THRESHOLD;
}

type StockLevel = "out" | "low" | "ok";

// Classifies a product's stock against the threshold. Out-of-stock is its own level, not just
// "low": zero is a stockout that blocks a sale, and it should not read the same amber as one
// unit short of the threshold.
function stockLevel(current: number, threshold: number): StockLevel {
  if (current <= 0) return "out";
  if (current <= threshold) return "low";
  return "ok";
}

const STOCK_PILL: Record<StockLevel, { label: string; className: string }> = {
  out: { label: "Sin stock", className: "bg-red-50 text-red-700 ring-red-200" },
  low: { label: "Stock bajo", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  ok: { label: "OK / Suficiente", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

// A hidden-field quick adjustment: a ±1 stock correction recorded as an "adjustment" movement,
// reusing the same guarded action as the manual form below.
function QuickAdjust({ productId, delta, label }: { productId: string; delta: 1 | -1; label: string }) {
  return (
    <form action={recordStockMovement as unknown as FormAction}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="movementType" value="adjustment" />
      <input type="hidden" name="quantity" value={String(delta)} />
      <input type="hidden" name="notes" value="Ajuste rápido" />
      <button
        type="submit"
        aria-label={label}
        className="grid h-8 w-8 place-items-center rounded-lg border border-brand-line text-brand-muted transition hover:border-brand-accent hover:text-brand-blue"
      >
        {delta > 0 ? <Plus aria-hidden="true" className="h-4 w-4" /> : <Minus aria-hidden="true" className="h-4 w-4" />}
      </button>
    </form>
  );
}

export default async function AdminInventoryPage({ searchParams }: InventoryPageProps) {
  // Both admin and staff hold "inventory:read" per the RBAC matrix, so this guard runs
  // before any query is issued.
  await requirePermission("inventory:read");

  const params = await searchParams;
  const threshold = parseThreshold(firstParam(params.threshold));
  const search = firstParam(params.search).trim();

  const products = await getStockLevels(search);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[0.65rem] font-black uppercase tracking-widest text-brand-blue">Inventario</p>
          <h1 className="text-2xl font-black tracking-tight text-brand-navy sm:text-3xl">Gestión de stock</h1>
          <p className="mt-2 text-sm font-medium text-brand-muted">
            Controla las existencias y disponibilidad de tus productos
          </p>
        </div>
        <Link
          href="/admin/inventory/movements"
          className="inline-flex items-center gap-2 rounded-full border border-brand-line px-5 py-3 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-accent"
        >
          <History aria-hidden="true" className="h-4 w-4" />
          Historial de movimientos
        </Link>
      </div>

      <form method="get" className="relative max-w-md">
        <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
        <label htmlFor="stock-search" className="sr-only">
          Buscar producto por nombre o SKU
        </label>
        <input
          id="stock-search"
          type="search"
          name="search"
          defaultValue={search}
          placeholder="Buscar producto por nombre o SKU…"
          className="w-full rounded-full border border-brand-line bg-white py-3 pl-11 pr-4 text-sm font-bold text-brand-navy shadow-sm"
        />
        {/* Preserves the threshold choice across a search submit. */}
        <input type="hidden" name="threshold" value={threshold} />
      </form>

      <div className="overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm shadow-blue-950/5">
        <table className="min-w-full divide-y divide-brand-line text-sm">
          <thead className="text-left text-xs font-black uppercase tracking-widest text-brand-muted">
            <tr>
              <th className="px-6 py-4">Producto</th>
              <th className="px-6 py-4">Disponible</th>
              <th className="px-6 py-4">Estado</th>
              <th className="px-6 py-4 text-right">Ajuste rápido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line/60">
            {products.length > 0 ? (
              products.map((product: ProductStock) => {
                const level = stockLevel(product.currentStock, threshold);
                const pill = STOCK_PILL[level];

                return (
                  <tr key={product.productId}>
                    <td className="px-6 py-4">
                      <p className="font-black text-slate-950">{product.name}</p>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">REF: {product.sku}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-lg font-black text-brand-navy">{product.currentStock}</span>
                      <span className="ml-1 text-xs font-bold text-brand-muted">uds</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ring-1 ${pill.className}`}>
                        {pill.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <QuickAdjust productId={product.productId} delta={-1} label={`Restar una unidad de ${product.name}`} />
                        <QuickAdjust productId={product.productId} delta={1} label={`Sumar una unidad de ${product.name}`} />
                        <Link
                          href={`/admin/inventory/movements?search=${encodeURIComponent(product.name)}`}
                          aria-label={`Ver movimientos de ${product.name}`}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-brand-line text-brand-muted transition hover:border-brand-accent hover:text-brand-blue"
                        >
                          <History aria-hidden="true" className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center font-bold text-brand-muted">
                  {search === "" ? "No hay productos en el catálogo." : `Sin resultados para “${search}”.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-950">Registrar movimiento</h2>
        <p className="text-sm font-medium text-brand-muted">
          Para entradas, salidas o ajustes con cantidad y nota. El ajuste rápido de la tabla registra ±1.
        </p>
        <form
          action={recordStockMovement as unknown as FormAction}
          className="grid max-w-2xl gap-3 rounded-2xl border border-brand-line bg-white p-6 shadow-sm shadow-blue-950/5 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <label htmlFor="productId" className="block text-xs font-black uppercase tracking-widest text-brand-muted">
              ID del producto
            </label>
            <input
              id="productId"
              name="productId"
              type="text"
              placeholder="Copiá el ID desde el detalle del producto"
              className="mt-1.5 w-full rounded-2xl border border-brand-line bg-brand-ice px-4 py-3 text-sm font-bold text-brand-navy"
            />
          </div>
          <div>
            <label htmlFor="movementType" className="block text-xs font-black uppercase tracking-widest text-brand-muted">
              Tipo de movimiento
            </label>
            <select
              id="movementType"
              name="movementType"
              className="mt-1.5 w-full rounded-2xl border border-brand-line bg-brand-ice px-4 py-3 text-sm font-bold text-brand-navy"
            >
              {MOVEMENT_TYPES.map((option) => (
                <option key={option} value={option}>
                  {movementTypeLabel(option)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="quantity" className="block text-xs font-black uppercase tracking-widest text-brand-muted">
              Cantidad (negativa para salidas)
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              className="mt-1.5 w-full rounded-2xl border border-brand-line bg-brand-ice px-4 py-3 text-sm font-bold text-brand-navy"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="notes" className="block text-xs font-black uppercase tracking-widest text-brand-muted">
              Notas
            </label>
            <input
              id="notes"
              name="notes"
              type="text"
              className="mt-1.5 w-full rounded-2xl border border-brand-line bg-brand-ice px-4 py-3 text-sm font-bold text-brand-navy"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-brand-blue px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-brand-primary"
            >
              Guardar movimiento
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
