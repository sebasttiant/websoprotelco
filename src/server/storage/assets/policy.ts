/**
 * What the runtime asset routes are allowed to serve, and under which caching contract.
 *
 * Pure data and pure functions: no filesystem, no HTTP. Everything that decides "may this ever be
 * served at all" lives here so the answer is auditable in one place.
 */

export const RUNTIME_ASSET_ROOTS = {
  UPLOADS: "uploads",
  DOCUMENTS: "documents",
} as const;

export type RuntimeAssetRoot = (typeof RUNTIME_ASSET_ROOTS)[keyof typeof RUNTIME_ASSET_ROOTS];

export const RUNTIME_ASSET_ROOT_VALUES: readonly RuntimeAssetRoot[] = Object.values(RUNTIME_ASSET_ROOTS);

/**
 * Per-root, never global. A shared map would let `/uploads/<uuid>.pdf` hand out a document and
 * `/documents/<cat>/<uuid>.webp` hand out an image, crossing two boundaries with different
 * response policies — documents are forced to `attachment` by next.config.ts, images are not.
 * Each map lists exactly what its storage adapter writes.
 */
const CONTENT_TYPES_BY_ROOT: Readonly<Record<RuntimeAssetRoot, Readonly<Record<string, string>>>> = {
  [RUNTIME_ASSET_ROOTS.UPLOADS]: {
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".png": "image/png",
  },
  [RUNTIME_ASSET_ROOTS.DOCUMENTS]: {
    ".pdf": "application/pdf",
  },
};

/**
 * Every path segment must look like something the storage adapters generate:
 * `2026-07-26-<uuid>.webp`, `<uuid>_<sanitized-name>.pdf`, or a fixed folder such as `banners`,
 * `hero`, `manual`. Requiring an alphanumeric first character makes `.` and `..` unrepresentable,
 * so traversal is rejected by the shape of the input rather than by chasing every encoding of it.
 * Next decodes percent-escapes before a handler runs, so `%2e%2e` arrives here as literal dots.
 */
const SAFE_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// Stored files are immutable: every write lands under a fresh UUID name, so the bytes behind a URL
// never change. Deletion is what must stay visible — a document removed in the admin has to stop
// being downloadable at once — so responses revalidate rather than sit in a cache. The validator
// keeps that cheap (304, no body).
export const ASSET_CACHE_CONTROL = "public, max-age=0, must-revalidate";

// A 404 must never be cached: the same URL shape is about to be used by the next upload.
export const MISS_CACHE_CONTROL = "no-store";

// Storage faults are transient by nature (a remount, a full disk being cleared), so clients and
// probes are told to come back rather than to treat the asset as gone.
export const STORAGE_RETRY_AFTER_SECONDS = "5";

export function hasSafeSegments(segments: readonly string[]): boolean {
  return segments.length > 0 && segments.every((segment) => SAFE_SEGMENT_PATTERN.test(segment));
}

function extensionOf(segment: string): string {
  const lastDot = segment.lastIndexOf(".");

  return lastDot > 0 ? segment.slice(lastDot).toLowerCase() : "";
}

/** The content type this root may declare for this filename, or null if it may not serve it. */
export function contentTypeFor(root: RuntimeAssetRoot, filename: string): string | null {
  return CONTENT_TYPES_BY_ROOT[root][extensionOf(filename)] ?? null;
}
