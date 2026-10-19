import { lstat, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  type DesignImageStorageAdapter,
  type DocumentStorageAdapter,
  type StorageAdapter,
  type StoredFile,
} from "./index";
import {
  OPTIMIZED_IMAGE_EXTENSION,
  optimizeDesignImage,
  optimizeProductImage,
} from "./optimize-image";
import { runtimeAssetRoots } from "./roots";

const { uploads: uploadDirectory, documents: documentsDirectory } = runtimeAssetRoots();
const bannerUploadsDirectory = path.join(uploadDirectory, "banners");
const heroUploadsDirectory = path.join(uploadDirectory, "hero");

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

// The reader rejects symlink components before it opens an asset. Writers must apply the same
// policy: lexical containment alone still follows an existing symlinked category directory.
async function assertNoSymlinkComponents(baseDir: string, targetPath: string): Promise<void> {
  const relative = path.relative(baseDir, targetPath);
  const parts = relative === "" ? [] : relative.split(path.sep);
  let current = baseDir;

  for (const part of ["", ...parts]) {
    if (part) current = path.join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new Error("Runtime asset path contains a symbolic link.");
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  }
}

// `pathname` here is the public-facing path stored on the document row (e.g.
// "/documents/manual/<uuid>_<name>.pdf"), not an absolute filesystem path — the domain
// layer never persists the absolute path, only the URL. This resolves it back to disk.
function resolveDocumentPath(pathname: string): string {
  return path.join(documentsDirectory, pathname.replace(/^\/documents\/?/, ""));
}

export function createLocalStorageAdapter(): StorageAdapter & DocumentStorageAdapter & DesignImageStorageAdapter {
  return {
    async save(file: File): Promise<StoredFile> {
      // The input has already passed validateUploadFile (real jpg/png/webp within the size cap).
      // Every stored image is re-encoded to a bounded WebP here, so the extension is always
      // `.webp` regardless of what was uploaded — the disk holds a ~200 KB web image, never the
      // multi-MB original. See optimize-image.ts for the rationale.
      const original = Buffer.from(await file.arrayBuffer());
      const optimized = await optimizeProductImage(original);

      const filename = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}.${OPTIMIZED_IMAGE_EXTENSION}`;
      const pathname = path.join(uploadDirectory, filename);

      await assertNoSymlinkComponents(uploadDirectory, pathname);
      await mkdir(uploadDirectory, { recursive: true });
      await assertNoSymlinkComponents(uploadDirectory, pathname);
      await writeFile(pathname, optimized, { flag: "wx" });

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

      await assertNoSymlinkComponents(documentsDirectory, pathname);
      await mkdir(targetDirectory, { recursive: true });
      await assertNoSymlinkComponents(documentsDirectory, pathname);
      await writeFile(pathname, bytes, { flag: "wx" });

      return {
        url: `/documents/${safeCategory}/${storedFilename}`,
        pathname,
      };
    },

    async saveDesignImage(file: File, target: "banners" | "hero"): Promise<StoredFile> {
      // Same optimize path as catalog images: EXIF-orient, bound long edge, WebP. Keeps banner
      // uploads from blowing the hero and avoids shipping multi-MB phone photos.
      const safeFilename = sanitizeImageFilename(file.name, OPTIMIZED_IMAGE_EXTENSION);
      const storedFilename = `${randomUUID()}_${safeFilename}`;
      const targetDirectory = target === "hero" ? heroUploadsDirectory : bannerUploadsDirectory;
      const pathname = path.join(targetDirectory, storedFilename);

      assertWithinDirectory(uploadDirectory, pathname);
      // Reject symlink mounts before spending CPU on sharp, and before any write.
      await assertNoSymlinkComponents(uploadDirectory, pathname);

      const original = Buffer.from(await file.arrayBuffer());
      const optimized = await optimizeDesignImage(original);

      await mkdir(targetDirectory, { recursive: true });
      await assertNoSymlinkComponents(uploadDirectory, pathname);
      await writeFile(pathname, optimized, { flag: "wx" });

      return {
        url: `/uploads/${target}/${storedFilename}`,
        pathname,
      };
    },

    async deleteFile(pathname: string): Promise<void> {
      const resolved = resolveDocumentPath(pathname);

      assertWithinDirectory(documentsDirectory, resolved);
      await assertNoSymlinkComponents(documentsDirectory, resolved);

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
