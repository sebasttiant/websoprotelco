import Link from "next/link";
import { Download, FileText } from "lucide-react";
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
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  const filterQuery = new URLSearchParams();
  if (category) filterQuery.set("category", category);
  if (productId) filterQuery.set("productId", productId);
  const filterPrefix = filterQuery.toString() ? `${filterQuery.toString()}&` : "";

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-brand-blue">Contenido</p>
          <h1 className="text-3xl font-black text-slate-950">Documentación</h1>
          <p className="mt-2 text-sm font-medium text-brand-muted">Recursos técnicos y catálogos</p>
        </div>
        <div className="rounded-[28px] border border-brand-line bg-white px-6 py-4 shadow-xl shadow-blue-950/5">
          <p className="text-xs font-black uppercase tracking-widest text-brand-muted">Total documentos</p>
          <p className="mt-1 text-3xl font-black text-brand-navy">{result.total}</p>
        </div>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-[28px] border border-brand-line bg-white p-4 shadow-xl shadow-blue-950/5">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="category" className="block text-xs font-black uppercase tracking-widest text-brand-muted">
            Categoría
          </label>
          <select
            id="category"
            name="category"
            defaultValue={category ?? ""}
            className="mt-1.5 w-full rounded-2xl border border-brand-line bg-brand-ice px-4 py-3 text-sm font-bold text-brand-navy"
          >
            <option value="">Todas las categorías</option>
            {DOCUMENT_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {documentCategoryLabel(option)}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="productId" className="block text-xs font-black uppercase tracking-widest text-brand-muted">
            ID del producto
          </label>
          <input
            id="productId"
            name="productId"
            type="text"
            defaultValue={rawProductId}
            className="mt-1.5 w-full rounded-2xl border border-brand-line bg-brand-ice px-4 py-3 text-sm font-bold text-brand-navy"
          />
        </div>
        <button type="submit" className="rounded-full bg-slate-950 px-6 py-3 text-xs font-black uppercase tracking-widest text-white">
          Filtrar
        </button>
      </form>

      <div className="overflow-hidden rounded-[28px] border border-brand-line bg-white shadow-xl shadow-blue-950/5">
        <table className="min-w-full divide-y divide-brand-line text-sm">
          <thead className="text-left text-xs font-black uppercase tracking-widest text-brand-muted">
            <tr>
              <th className="px-6 py-4">Documento</th>
              <th className="px-6 py-4">Tipo</th>
              <th className="px-6 py-4">Producto</th>
              <th className="px-6 py-4">Peso</th>
              <th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line/60">
            {result.documents.length > 0 ? (
              result.documents.map((document) => (
                <tr key={document.id}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700">
                        <FileText className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-950">{document.title}</p>
                        <p className="text-xs font-bold text-slate-500">Subido el {formatDate(document.createdAt)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full bg-brand-ice px-3 py-1 text-xs font-black uppercase tracking-wide text-brand-navy">
                      {documentCategoryLabel(document.category)}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-brand-navy">{document.productName ?? "—"}</td>
                  <td className="px-6 py-4 font-bold text-brand-muted">{formatFileSize(document.fileSize)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {isSafeDocumentHref(document.filePath) ? (
                        <a
                          href={document.filePath}
                          download
                          aria-label={`Descargar "${document.title}"`}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-brand-ice hover:text-brand-blue"
                        >
                          <Download aria-hidden="true" className="h-4 w-4" />
                        </a>
                      ) : (
                        // Defense-in-depth: `filePath` is validated at the input boundary
                        // (documentCreateInputSchema), but this render sink refuses to emit an
                        // anchor for any value that isn't a known-safe internal path (a legacy
                        // row or a direct DB edit), since React does not sanitize `href`.
                        <span className="px-2 text-xs font-bold text-slate-400">No disponible</span>
                      )}
                      <form action={deleteDocument as unknown as FormAction}>
                        <input type="hidden" name="id" value={document.id} />
                        <ConfirmDialog
                          message={`¿Eliminar el documento "${document.title}"? Esta acción no se puede deshacer.`}
                          triggerClassName="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <span aria-hidden="true">🗑</span>
                          <span className="sr-only">Eliminar “{document.title}”</span>
                        </ConfirmDialog>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center font-bold text-brand-muted">
                  No se encontraron documentos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {result.total > result.pageSize ? (
        <nav aria-label="Paginación de documentos" className="flex items-center justify-between text-sm font-bold text-brand-muted">
          <Link
            aria-label="Página anterior"
            aria-disabled={page <= 1}
            href={`/admin/documents?${filterPrefix}page=${Math.max(1, page - 1)}`}
            className="rounded-full border border-brand-line px-4 py-2 transition hover:border-brand-accent aria-disabled:pointer-events-none aria-disabled:opacity-40"
          >
            Anterior
          </Link>
          <span>
            Página {result.page} de {totalPages}
          </span>
          <Link
            aria-label="Página siguiente"
            aria-disabled={page >= totalPages}
            href={`/admin/documents?${filterPrefix}page=${page + 1}`}
            className="rounded-full border border-brand-line px-4 py-2 transition hover:border-brand-accent aria-disabled:pointer-events-none aria-disabled:opacity-40"
          >
            Siguiente
          </Link>
        </nav>
      ) : null}

      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-950">Subir nuevo documento</h2>
        <form action={createDocument as unknown as FormAction} className="grid max-w-2xl gap-3 rounded-[28px] border border-brand-line bg-white p-6 shadow-xl shadow-blue-950/5">
          <div>
            <label htmlFor="title" className="block text-xs font-black uppercase tracking-widest text-brand-muted">
              Título
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              className="mt-1.5 w-full rounded-2xl border border-brand-line bg-brand-ice px-4 py-3 text-sm font-bold text-brand-navy"
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-xs font-black uppercase tracking-widest text-brand-muted">
              Descripción
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              className="mt-1.5 w-full rounded-2xl border border-brand-line bg-brand-ice px-4 py-3 text-sm font-bold text-brand-navy"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="create-category" className="block text-xs font-black uppercase tracking-widest text-brand-muted">
                Categoría
              </label>
              <select
                id="create-category"
                name="category"
                className="mt-1.5 w-full rounded-2xl border border-brand-line bg-brand-ice px-4 py-3 text-sm font-bold text-brand-navy"
              >
                {DOCUMENT_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {documentCategoryLabel(option)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="create-productId" className="block text-xs font-black uppercase tracking-widest text-brand-muted">
                ID del producto (opcional)
              </label>
              <input
                id="create-productId"
                name="productId"
                type="text"
                className="mt-1.5 w-full rounded-2xl border border-brand-line bg-brand-ice px-4 py-3 text-sm font-bold text-brand-navy"
              />
            </div>
          </div>
          <DocumentUploadField label="Archivo PDF" />
          <button type="submit" className="rounded-full bg-brand-blue px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-brand-primary">
            Guardar documento
          </button>
        </form>
      </div>
    </section>
  );
}
