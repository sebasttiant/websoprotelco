import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  ALLOWED_IMAGE_TYPES,
  type DesignImageStorageAdapter,
  type DocumentStorageAdapter,
  type StorageAdapter,
  type StoredFile,
} from "./index";

const uploadDirectory = path.join(process.cwd(), "public", "uploads");
const publicDirectory = path.join(process.cwd(), "public");
const documentsDirectory = path.join(publicDirectory, "documents");
const bannerUploadsDirectory = path.join(uploadDirectory, "banners");
const heroUploadsDirectory = path.join(uploadDirectory, "hero");

const EXTENSIONS_BY_TYPE: Readonly<Record<string, string>> = {
  [ALLOWED_IMAGE_TYPES.JPEG]: "jpg",
  [ALLOWED_IMAGE_TYPES.PNG]: "png",
  [ALLOWED_IMAGE_TYPES.WEBP]: "webp",
};

// Kept as a local list (not imported from `@/domains/documents`) so this low-level storage
// module never depends on a higher-level domain. Must stay in sync with
// `DOCUMENT_CATEGORIES` in `src/domains/documents/schemas.ts`.
const DOCUMENT_CATEGORIES = new Set(["manual", "datasheet", "certificate", "warranty", "other"]);

const MAX_DOCUMENT_BASENAME_LENGTH = 100;
const UNSAFE_FILENAME_CHARACTERS = /[^a-zA-Z0-9._-]/g;

export function sanitizeDocumentCategory(category: string): string {
  return DOCUMENT_CATEGORIES.has(category) ? category : "other";
}

// `rawName` is attacker-controlled (`file.name` from the multipart upload). Splitting on
// both separators regardless of host OS prevents a `..\\..\\x.pdf`-style traversal attempt
// from surviving on a POSIX host, where `path.basename` alone would not strip backslashes.
function lastPathSegment(rawName: string): string {
  const segments = rawName.split(/[\\/]+/).filter(Boolean);
  return segments[segments.length - 1] ?? "";
}

export function sanitizeDocumentFilename(rawName: string): string {
  const segment = lastPathSegment(rawName ?? "");
  const sanitized = segment.replace(UNSAFE_FILENAME_CHARACTERS, "_").replace(/_+/g, "_");

  // Drop whatever extension the caller supplied — the stored file is always `.pdf`,
  // never `<name>.pdf.pdf` or `<name>.exe.pdf`.
  const lastDotIndex = sanitized.lastIndexOf(".");
  const base = lastDotIndex > -1 ? sanitized.slice(0, lastDotIndex) : sanitized;
  const withoutLeadingDots = base.replace(/^\.+/, "");
  const truncated = withoutLeadingDots.slice(0, MAX_DOCUMENT_BASENAME_LENGTH);

  return `${truncated || "document"}.pdf`;
}

export function sanitizeImageFilename(rawName: string, extension: string): string {
  const segment = lastPathSegment(rawName ?? "");
  const sanitized = segment.replace(UNSAFE_FILENAME_CHARACTERS, "_").replace(/_+/g, "_");
  const lastDotIndex = sanitized.lastIndexOf(".");
  const base = lastDotIndex > -1 ? sanitized.slice(0, lastDotIndex) : sanitized;
  const withoutLeadingDots = base.replace(/^\.+/, "");
  const truncated = withoutLeadingDots.slice(0, MAX_DOCUMENT_BASENAME_LENGTH);

  return `${truncated || "image"}.${extension}`;
}

// Defends against a sanitized-but-still-malicious path (or a programming error) landing
// outside the documents directory. `path.resolve` collapses any remaining `..` segments
// before the comparison, so this is the actual containment check, not the sanitizer.
function assertWithinDirectory(baseDir: string, targetPath: string): void {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);

  if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new Error("Resolved path escapes the documents directory.");
  }
}

// `pathname` here is the public-facing path stored on the document row (e.g.
// "/documents/manual/<uuid>_<name>.pdf"), not an absolute filesystem path — the domain
// layer never persists the absolute path, only the URL. This resolves it back to disk.
function resolvePublicPath(pathname: string): string {
  const relative = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  return path.join(publicDirectory, relative);
}

export function createLocalStorageAdapter(): StorageAdapter & DocumentStorageAdapter & DesignImageStorageAdapter {
  return {
    async save(file: File): Promise<StoredFile> {
      const extension = EXTENSIONS_BY_TYPE[file.type] ?? "bin";
      const filename = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}.${extension}`;
      const pathname = path.join(uploadDirectory, filename);
      const bytes = Buffer.from(await file.arrayBuffer());

      await mkdir(uploadDirectory, { recursive: true });
      await writeFile(pathname, bytes, { flag: "wx" });

      return {
        url: `/uploads/${filename}`,
        pathname,
      };
    },

    async saveDocument(file: File, category: string): Promise<StoredFile> {
      const safeCategory = sanitizeDocumentCategory(category);
      const safeFilename = sanitizeDocumentFilename(file.name);
      const storedFilename = `${randomUUID()}_${safeFilename}`;
      const targetDirectory = path.join(documentsDirectory, safeCategory);
      const pathname = path.join(targetDirectory, storedFilename);

      assertWithinDirectory(documentsDirectory, pathname);

      const bytes = Buffer.from(await file.arrayBuffer());

      await mkdir(targetDirectory, { recursive: true });
      await writeFile(pathname, bytes, { flag: "wx" });

      return {
        url: `/documents/${safeCategory}/${storedFilename}`,
        pathname,
      };
    },

    async saveDesignImage(file: File, target: "banners" | "hero"): Promise<StoredFile> {
      const extension = EXTENSIONS_BY_TYPE[file.type] ?? "bin";
      const safeFilename = sanitizeImageFilename(file.name, extension);
      const storedFilename = `${randomUUID()}_${safeFilename}`;
      const targetDirectory = target === "hero" ? heroUploadsDirectory : bannerUploadsDirectory;
      const pathname = path.join(targetDirectory, storedFilename);

      assertWithinDirectory(uploadDirectory, pathname);

      const bytes = Buffer.from(await file.arrayBuffer());

      await mkdir(targetDirectory, { recursive: true });
      await writeFile(pathname, bytes, { flag: "wx" });

      return {
        url: `/uploads/${target}/${storedFilename}`,
        pathname,
      };
    },

    async deleteFile(pathname: string): Promise<void> {
      const resolved = resolvePublicPath(pathname);

      assertWithinDirectory(documentsDirectory, resolved);

      try {
        await unlink(resolved);
      } catch (error) {
        // Best effort: a document row can be deleted even if the file is already gone.
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    },
  };
}
