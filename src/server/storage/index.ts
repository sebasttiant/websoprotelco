export const ALLOWED_IMAGE_TYPES = {
  JPEG: "image/jpeg",
  PNG: "image/png",
  WEBP: "image/webp",
} as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[keyof typeof ALLOWED_IMAGE_TYPES];

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_DOCUMENT_TYPES = {
  PDF: "application/pdf",
} as const;

export type AllowedDocumentType = (typeof ALLOWED_DOCUMENT_TYPES)[keyof typeof ALLOWED_DOCUMENT_TYPES];

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

export interface StoredFile {
  url: string;
  pathname: string;
}

export interface StorageAdapter {
  save(file: File): Promise<StoredFile>;
}

// Kept separate from `StorageAdapter` so image-only callers are not forced to depend on
// document methods. `createLocalStorageAdapter()` returns an object implementing both.
export interface DocumentStorageAdapter {
  saveDocument(file: File, category: string): Promise<StoredFile>;
  deleteFile(pathname: string): Promise<void>;
}

export interface DesignImageStorageAdapter {
  saveDesignImage(file: File, target: "banners" | "hero"): Promise<StoredFile>;
}

export interface UploadValidationResult {
  valid: boolean;
  error?: string;
}

const allowedImageTypes = new Set<string>(Object.values(ALLOWED_IMAGE_TYPES));

const IMAGE_SIGNATURES: Readonly<Record<AllowedImageType, readonly number[]>> = {
  [ALLOWED_IMAGE_TYPES.JPEG]: [0xff, 0xd8, 0xff],
  [ALLOWED_IMAGE_TYPES.PNG]: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  [ALLOWED_IMAGE_TYPES.WEBP]: [0x52, 0x49, 0x46, 0x46],
};

function hasSignature(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function hasValidImageSignature(bytes: Uint8Array, type: AllowedImageType): boolean {
  if (type === ALLOWED_IMAGE_TYPES.WEBP) {
    return hasSignature(bytes, IMAGE_SIGNATURES[type]) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }

  return hasSignature(bytes, IMAGE_SIGNATURES[type]);
}

export async function validateUploadFile(file: File | null): Promise<UploadValidationResult> {
  if (!file || file.size === 0) {
    return { valid: false, error: "Tenés que subir un archivo de imagen." };
  }

  if (!allowedImageTypes.has(file.type)) {
    return { valid: false, error: "Solo se admiten imágenes JPG, PNG y WebP." };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { valid: false, error: "La imagen debe pesar 5MB o menos." };
  }

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());

  if (!hasValidImageSignature(bytes, file.type as AllowedImageType)) {
    return { valid: false, error: "El contenido de la imagen no coincide con el tipo declarado." };
  }

  return { valid: true };
}

export async function createStorageAdapter(): Promise<StorageAdapter> {
  const { createLocalStorageAdapter } = await import("./local");

  return createLocalStorageAdapter();
}

// %PDF- (the PDF file signature required by every valid PDF, regardless of version).
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] as const;

export async function validateDocumentFile(file: File | null): Promise<UploadValidationResult> {
  if (!file || file.size === 0) {
    return { valid: false, error: "Tenés que subir un documento." };
  }

  if (file.type !== ALLOWED_DOCUMENT_TYPES.PDF) {
    return { valid: false, error: "Solo se admiten documentos PDF." };
  }

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return { valid: false, error: "El documento debe pesar 10MB o menos." };
  }

  const bytes = new Uint8Array(await file.slice(0, PDF_SIGNATURE.length).arrayBuffer());

  if (!hasSignature(bytes, PDF_SIGNATURE)) {
    return { valid: false, error: "El contenido del documento no coincide con el tipo declarado." };
  }

  return { valid: true };
}

export async function createDocumentStorageAdapter(): Promise<DocumentStorageAdapter> {
  const { createLocalStorageAdapter } = await import("./local");

  return createLocalStorageAdapter();
}

export async function createDesignImageStorageAdapter(): Promise<DesignImageStorageAdapter> {
  const { createLocalStorageAdapter } = await import("./local");

  return createLocalStorageAdapter();
}
