import Link from "next/link";

import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  getLowStockProducts,
  getMovementHistory,
  isProductId,
  MOVEMENT_TYPES,
  recordStockMovement,
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

function parsePage(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

export default async function AdminInventoryPage({ searchParams }: InventoryPageProps) {
  // Both admin and staff hold "inventory:read" per the RBAC matrix, so this guard runs
  // before any query is issued.
  await requirePermission("inventory:read");

  const params = await searchParams;
  const threshold = parseThreshold(firstParam(params.threshold));
  const rawProductId = firstParam(params.productId).trim();
  // `productId` flows into a `WHERE m.product_id = $1` clause against a UUID column. A
  // non-UUID value in the URL would otherwise reach Postgres and crash the page with
  // "invalid input syntax for type uuid", so anything invalid is treated as absent.
  const productId = isProductId(rawProductId) ? rawProductId : null;
  const page = parsePage(firstParam(params.page));

  const lowStockProducts = await getLowStockProducts(threshold);
  const history = productId ? await getMovementHistory(productId, page) : null;

  return (
    <section className="space-y-10">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Administration</p>
        <h1 className="text-3xl font-black text-slate-950">Inventory</h1>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-950">Low stock</h2>
        <form method="get" className="flex items-end gap-2">
          <div>
            <label htmlFor="threshold" className="block text-xs font-bold text-slate-500">
              Threshold
            </label>
            <input
              id="threshold"
              name="threshold"
              type="number"
              defaultValue={threshold}
              className="w-24 rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="rounded bg-brand-blue px-4 py-2 text-sm font-bold text-white">
            Apply
          </button>
        </form>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Current stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lowStockProducts.length > 0 ? (
                lowStockProducts.map((product) => (
                  <tr key={product.productId}>
                    <td className="px-4 py-3">{product.sku}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/inventory?threshold=${threshold}&productId=${product.productId}`}
                        className="font-bold text-brand-blue hover:underline"
                      >
                        {product.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{product.currentStock}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center font-medium text-slate-500">
                    No products below the threshold.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-950">Record movement</h2>
        <form action={recordStockMovement as unknown as FormAction} className="max-w-xl space-y-3 rounded-lg border border-slate-200 p-4">
          <div>
            <label htmlFor="productId" className="block text-xs font-bold text-slate-500">
              Product ID
            </label>
            <input
              id="productId"
              name="productId"
              type="text"
              defaultValue={rawProductId}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="movementType" className="block text-xs font-bold text-slate-500">
              Movement type
            </label>
            <select
              id="movementType"
              name="movementType"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {MOVEMENT_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="quantity" className="block text-xs font-bold text-slate-500">
              Quantity (negative for outgoing movements)
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="notes" className="block text-xs font-bold text-slate-500">
              Notes
            </label>
            <input
              id="notes"
              name="notes"
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="rounded bg-brand-blue px-4 py-2 text-sm font-bold text-white">
            Save
          </button>
        </form>
      </div>

      {history ? (
        <div className="space-y-4">
          <h2 className="text-lg font-black text-slate-950">History</h2>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.movements.length > 0 ? (
                  history.movements.map((movement) => (
                    <tr key={movement.id}>
                      <td className="px-4 py-3">{movement.movementType}</td>
                      <td className="px-4 py-3">{movement.quantity}</td>
                      <td className="px-4 py-3">{movement.notes ?? "—"}</td>
                      <td className="px-4 py-3">{new Date(movement.createdAt).toLocaleString("en-US")}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center font-medium text-slate-500">
                      No movements recorded for this product.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm font-bold text-slate-600">
            <Link
              aria-disabled={page <= 1}
              href={`/admin/inventory?threshold=${threshold}&productId=${productId}&page=${Math.max(1, page - 1)}`}
              className="rounded-full border border-slate-200 px-4 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              Previous
            </Link>
            <span>
              Page {history.page} of {Math.max(1, Math.ceil(history.total / history.pageSize))}
            </span>
            <Link
              aria-disabled={page * history.pageSize >= history.total}
              href={`/admin/inventory?threshold=${threshold}&productId=${productId}&page=${page + 1}`}
              className="rounded-full border border-slate-200 px-4 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              Next
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}
