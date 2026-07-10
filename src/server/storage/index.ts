export const ALLOWED_IMAGE_TYPES = {
  JPEG: "image/jpeg",
  PNG: "image/png",
  WEBP: "image/webp",
} as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[keyof typeof ALLOWED_IMAGE_TYPES];

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export interface StoredFile {
  url: string;
  pathname: string;
}

export interface StorageAdapter {
  save(file: File): Promise<StoredFile>;
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
    return { valid: false, error: "Image file is required." };
  }

  if (!allowedImageTypes.has(file.type)) {
    return { valid: false, error: "Only JPG, PNG, and WebP images are allowed." };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { valid: false, error: "Image must be 5MB or smaller." };
  }

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());

  if (!hasValidImageSignature(bytes, file.type as AllowedImageType)) {
    return { valid: false, error: "Image content does not match the declared file type." };
  }

  return { valid: true };
}

export async function createStorageAdapter(): Promise<StorageAdapter> {
  const { createLocalStorageAdapter } = await import("./local");

  return createLocalStorageAdapter();
}
