import Link from "next/link";
import { z } from "zod";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DocumentUploadField } from "@/components/admin/document-upload-field";
import { documentCategoryLabel, formatDate } from "@/lib/presentation";
import {
  createDocument,
  deleteDocument,
  DOCUMENT_CATEGORIES,
  getDocuments,
  isDocumentCategory,
  isSafeDocumentHref,
} from "@/domains/documents";
import { requirePermission } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

interface DocumentsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parsePage(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

function isUuid(value: string): boolean {
  return z.uuid().safeParse(value).success;
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) {
    return "—";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function AdminDocumentsPage({ searchParams }: DocumentsPageProps) {
  // Both admin and staff hold "documents:read" per the RBAC matrix.
  await requirePermission("documents:read");

  const params = await searchParams;
  const rawCategory = firstParam(params.category).trim();
  const category = isDocumentCategory(rawCategory) ? rawCategory : undefined;
  const rawProductId = firstParam(params.productId).trim();
  // `productId` flows into a `WHERE d.product_id = $n` clause against a UUID column. A
  // non-UUID value in the URL would otherwise reach Postgres and crash the page with
  // "invalid input syntax for type uuid", so anything invalid is treated as absent.
  const productId = isUuid(rawProductId) ? rawProductId : undefined;
  const page = parsePage(firstParam(params.page));

  const result = await getDocuments({ category, productId }, page);

  const filterQuery = new URLSearchParams();
  if (category) filterQuery.set("category", category);
  if (productId) filterQuery.set("productId", productId);

  return (
    <section className="space-y-10">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Administración</p>
        <h1 className="text-3xl font-black text-slate-950">Documentos</h1>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-950">Filtro</h2>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="category" className="block text-xs font-bold text-slate-500">
              Categoría
            </label>
            <select
              id="category"
              name="category"
              defaultValue={category ?? ""}
              className="w-48 rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Todas las categorías</option>
              {DOCUMENT_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {documentCategoryLabel(option)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="productId" className="block text-xs font-bold text-slate-500">
              ID del producto
            </label>
            <input
              id="productId"
              name="productId"
              type="text"
              defaultValue={rawProductId}
              className="w-64 rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="rounded bg-brand-blue px-4 py-2 text-sm font-bold text-white">
            Aplicar
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-950">Todos los documentos</h2>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Tamaño</th>
                <th className="px-4 py-3">Subido</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.documents.length > 0 ? (
                result.documents.map((document) => (
                  <tr key={document.id}>
                    <td className="px-4 py-3 font-bold text-slate-800">{document.title}</td>
                    <td className="px-4 py-3">{documentCategoryLabel(document.category)}</td>
                    <td className="px-4 py-3">{document.productName ?? "—"}</td>
                    <td className="px-4 py-3">{formatFileSize(document.fileSize)}</td>
                    <td className="px-4 py-3">{formatDate(document.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {isSafeDocumentHref(document.filePath) ? (
                          <a
                            href={document.filePath}
                            className="font-bold text-brand-blue hover:underline"
                            download
                          >
                            Descargar
                          </a>
                        ) : (
                          // Defense-in-depth: `filePath` is validated at the input boundary
                          // (documentCreateInputSchema), but this render sink refuses to emit
                          // an anchor for any value that isn't a known-safe internal path
                          // (e.g. a legacy row or a direct DB edit), since React does not
                          // sanitize `href`.
                          <span className="font-bold text-slate-400">No disponible</span>
                        )}
                        <form action={deleteDocument as unknown as FormAction}>
                          <input type="hidden" name="id" value={document.id} />
                          <ConfirmDialog
                            message={`¿Eliminar el documento "${document.title}"? Esta acción no se puede deshacer.`}
                            triggerClassName="font-bold text-rose-600 hover:underline"
                          >
                            Eliminar
                          </ConfirmDialog>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center font-medium text-slate-500">
                    No se encontraron documentos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between text-sm font-bold text-slate-600">
          <Link
            aria-label="Página anterior"
            aria-disabled={page <= 1}
            href={`/admin/documents?${filterQuery.toString()}${filterQuery.toString() ? "&" : ""}page=${Math.max(1, page - 1)}`}
            className="rounded-full border border-slate-200 px-4 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-40"
          >
            Anterior
          </Link>
          <span>
            Página {result.page} de {Math.max(1, Math.ceil(result.total / result.pageSize))}
          </span>
          <Link
            aria-label="Página siguiente"
            aria-disabled={page * result.pageSize >= result.total}
            href={`/admin/documents?${filterQuery.toString()}${filterQuery.toString() ? "&" : ""}page=${page + 1}`}
            className="rounded-full border border-slate-200 px-4 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-40"
          >
            Siguiente
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-950">Subir documento</h2>
        <form action={createDocument as unknown as FormAction} className="max-w-xl space-y-3 rounded-lg border border-slate-200 p-4">
          <div>
            <label htmlFor="title" className="block text-xs font-bold text-slate-500">
              Título
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-xs font-bold text-slate-500">
              Descripción
            </label>
            <textarea
              id="description"
              name="description"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="create-category" className="block text-xs font-bold text-slate-500">
              Categoría
            </label>
            <select
              id="create-category"
              name="category"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {DOCUMENT_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {documentCategoryLabel(option)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="create-productId" className="block text-xs font-bold text-slate-500">
              ID del producto (opcional)
            </label>
            <input
              id="create-productId"
              name="productId"
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <DocumentUploadField label="Archivo PDF" />
          <button type="submit" className="rounded bg-brand-blue px-4 py-2 text-sm font-bold text-white">
            Guardar
          </button>
        </form>
      </div>
    </section>
  );
}
