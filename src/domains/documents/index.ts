// Public surface of the documents domain. Consumers (admin pages, components) must import
// from here rather than reaching into ./schemas, ./repository, ./service, or ./actions
// directly.

export type { DocumentCategory, DocumentCreateInput, DocumentDeleteInput, DocumentSummary } from "./schemas";

export { DOCUMENT_CATEGORIES, DOCUMENT_PAGE_SIZE, isDocumentCategory, isSafeDocumentHref } from "./schemas";

export { getDocument, getDocuments, type DocumentListResult } from "./service";

export { createDocument, deleteDocument, type DocumentsActionState } from "./actions";
