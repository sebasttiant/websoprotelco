import "server-only";

import type { QueryResultRow } from "pg";

import { query } from "@/server/db/pool";

import type { DocumentCreateInput } from "./schemas";

export interface DocumentRow extends QueryResultRow {
  id: string;
  title: string;
  description: string | null;
  file_path: string;
  file_name: string;
  file_size: number | null;
  category: string;
  product_id: string | null;
  product_name: string | null;
  uploaded_by: string | null;
  download_count: number;
  created_at: string;
}

export interface DocumentFilters {
  category?: string;
  productId?: string;
}

const DOCUMENT_SELECT = `
  SELECT d.id, d.title, d.description, d.file_path, d.file_name, d.file_size, d.category,
         d.product_id, p.name AS product_name, d.uploaded_by, d.download_count, d.created_at
  FROM documents d
  LEFT JOIN products p ON p.id = d.product_id
`;

function buildWhereClause(filters: DocumentFilters, values: unknown[]): string {
  const conditions: string[] = [];

  if (filters.category) {
    values.push(filters.category);
    conditions.push(`d.category = $${values.length}`);
  }

  if (filters.productId) {
    values.push(filters.productId);
    conditions.push(`d.product_id = $${values.length}`);
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
}

export async function createDocument(input: DocumentCreateInput, uploadedBy: string | null): Promise<void> {
  await query(
    `INSERT INTO documents (title, description, file_path, file_name, file_size, category, product_id, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.title,
      input.description ?? null,
      input.filePath,
      input.fileName,
      input.fileSize ?? null,
      input.category,
      input.productId,
      uploadedBy,
    ],
  );
}

export async function findDocuments(filters: DocumentFilters, limit: number, offset: number): Promise<DocumentRow[]> {
  const values: unknown[] = [];
  const where = buildWhereClause(filters, values);

  values.push(limit, offset);

  return query<DocumentRow>(
    `${DOCUMENT_SELECT}
     ${where}
     ORDER BY d.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
}

export async function countDocuments(filters: DocumentFilters): Promise<number> {
  const values: unknown[] = [];
  const where = buildWhereClause(filters, values);

  const rows = await query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM documents d ${where}`,
    values,
  );

  return rows[0]?.total ?? 0;
}

export async function findDocumentById(id: string): Promise<DocumentRow | null> {
  const rows = await query<DocumentRow>(`${DOCUMENT_SELECT} WHERE d.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function deleteDocumentById(id: string): Promise<void> {
  await query("DELETE FROM documents WHERE id = $1", [id]);
}

// Used by the service before unlinking a document's underlying file: another row must not
// still reference the same `file_path` (broken object-level access control otherwise lets
// deleting one document row remove a file another row still needs).
export async function countByFilePath(filePath: string): Promise<number> {
  const rows = await query<{ total: number }>(
    "SELECT COUNT(*)::int AS total FROM documents WHERE file_path = $1",
    [filePath],
  );

  return rows[0]?.total ?? 0;
}
