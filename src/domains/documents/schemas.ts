import { z } from "zod";

// --- Category -----------------------------------------------------------------

export const DOCUMENT_CATEGORIES = ["manual", "datasheet", "certificate", "warranty", "other"] as const;

export const documentCategorySchema = z.enum(DOCUMENT_CATEGORIES);

export type DocumentCategory = z.infer<typeof documentCategorySchema>;

export function isDocumentCategory(value: string): value is DocumentCategory {
  return (DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}

// --- File size ------------------------------------------------------------------

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// --- Pagination -----------------------------------------------------------------

export const DOCUMENT_PAGE_SIZE = 20;

// --- Read model -----------------------------------------------------------------

export const documentSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  filePath: z.string(),
  fileName: z.string(),
  fileSize: z.number().int().nullable(),
  category: documentCategorySchema,
  productId: z.string().nullable(),
  productName: z.string().nullable(),
  uploadedBy: z.string().nullable(),
  downloadCount: z.number().int(),
  createdAt: z.string(),
});

export type DocumentSummary = z.infer<typeof documentSummarySchema>;

// --- File path --------------------------------------------------------------------

// `filePath` is attacker-controllable (submitted via a hidden form field, bypassable via
// curl or by editing the DOM) and is rendered as `<a href={document.filePath}>` in
// `src/app/admin/documents/page.tsx`. React does NOT sanitize `href`, so an unconstrained
// string here would allow `javascript:` URIs or `//host` open redirects to be stored and
// served back to any admin/staff who clicks Download. Constraining the schema to the exact
// shape the storage adapter emits (`saveDocument` in `src/server/storage/local.ts`, which
// always writes `/documents/<category>/<uuid>_<sanitized-filename>.pdf`) closes this off at
// the input boundary. The category alternation below MUST stay in sync with
// `DOCUMENT_CATEGORIES` above.
const DOCUMENT_FILE_PATH_PATTERN =
  /^\/documents\/(manual|datasheet|certificate|warranty|other)\/[0-9a-fA-F-]{36}_[A-Za-z0-9._-]+\.pdf$/;

// Defense-in-depth guard for render sinks (e.g. the Download `<a href>` in the admin
// documents page). Prefer schema validation at the input boundary; this exists so a render
// site can refuse to emit an anchor for any value that isn't a known-safe internal path,
// even if it somehow bypassed the schema (legacy row, direct DB edit, etc.).
export function isSafeDocumentHref(path: string): boolean {
  return DOCUMENT_FILE_PATH_PATTERN.test(path);
}

// --- Admin mutation input ---------------------------------------------------------

export const documentCreateInputSchema = z.object({
  title: z.string().trim().min(1, { error: "Title is required." }).max(300, { error: "Title must be 300 characters or fewer." }),
  description: z.string().trim().max(2000, { error: "Description must be 2000 characters or fewer." }).optional(),
  filePath: z
    .string()
    .trim()
    .max(500)
    .regex(DOCUMENT_FILE_PATH_PATTERN, { error: "Invalid file path." }),
  fileName: z
    .string()
    .trim()
    .min(1, { error: "File name is required." })
    .max(200)
    .regex(/^[^\r\n]+$/, { error: "File name must not contain line breaks." }),
  fileSize: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_DOCUMENT_FILE_SIZE_BYTES, { error: "File must be 10MB or smaller." })
    .optional(),
  category: documentCategorySchema,
  productId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
});

export type DocumentCreateInput = z.infer<typeof documentCreateInputSchema>;

export const documentDeleteInputSchema = z.object({
  id: z.uuid(),
});

export type DocumentDeleteInput = z.infer<typeof documentDeleteInputSchema>;
