import { createDocumentStorageAdapter } from "@/server/storage";

import * as repository from "./repository";
import type { DocumentFilters, DocumentRow } from "./repository";
import { DOCUMENT_PAGE_SIZE, type DocumentCreateInput, type DocumentSummary } from "./schemas";

export { DOCUMENT_PAGE_SIZE };

function mapDocumentSummary(row: DocumentRow): DocumentSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    filePath: row.file_path,
    fileName: row.file_name,
    fileSize: row.file_size,
    category: row.category as DocumentSummary["category"],
    productId: row.product_id,
    productName: row.product_name,
    uploadedBy: row.uploaded_by,
    downloadCount: row.download_count,
    createdAt: row.created_at,
  };
}

export async function createDocument(input: DocumentCreateInput, uploadedBy: string | null): Promise<void> {
  await repository.createDocument(input, uploadedBy);
}

export interface DocumentListResult {
  documents: DocumentSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getDocuments(filters: DocumentFilters, page = 1): Promise<DocumentListResult> {
  const currentPage = Math.max(1, page);
  const offset = (currentPage - 1) * DOCUMENT_PAGE_SIZE;

  const [rows, total] = await Promise.all([
    repository.findDocuments(filters, DOCUMENT_PAGE_SIZE, offset),
    repository.countDocuments(filters),
  ]);

  return {
    documents: rows.map(mapDocumentSummary),
    total,
    page: currentPage,
    pageSize: DOCUMENT_PAGE_SIZE,
  };
}

export async function getDocument(id: string): Promise<DocumentSummary | null> {
  const row = await repository.findDocumentById(id);
  return row ? mapDocumentSummary(row) : null;
}

export async function deleteDocument(id: string): Promise<void> {
  const row = await repository.findDocumentById(id);

  if (!row) {
    return;
  }

  await repository.deleteDocumentById(id);

  // Object-level access control: only unlink the underlying file when no other document row
  // still references the same `file_path`. Without this, deleting document A could remove a
  // file document B still needs.
  //
  // Known limitation: this check is not airtight against a TOCTOU race where a staff user
  // deletes the last reference while another staff request concurrently creates a document
  // reusing the same path before the unlink runs. Closing that gap requires a repository-level
  // transactional helper (delete + reference count/lock + unlink decision in one critical
  // section), which this codebase does not have yet.
  const remainingReferences = await repository.countByFilePath(row.file_path);

  if (remainingReferences > 0) {
    return;
  }

  try {
    const storage = await createDocumentStorageAdapter();
    await storage.deleteFile(row.file_path);
  } catch (error) {
    // Best effort: the metadata row is already gone, so a storage failure here (disk error,
    // permission issue, etc.) must not surface as a failed delete to the admin user.
    console.error("Failed to delete document file:", error);
  }
}
