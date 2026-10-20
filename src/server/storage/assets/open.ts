import { constants as fsConstants } from "node:fs";
import { lstat, open, readlink, realpath, type FileHandle } from "node:fs/promises";
import path from "node:path";
import type { Stats } from "node:fs";

import { errorCode, type AssetOperation } from "./diagnostics";
import { contentTypeFor, hasSafeSegments, type RuntimeAssetRoot } from "./policy";

/**
 * Trusted-root containment.
 *
 * The trust anchor is the canonical `public` directory. Everything below it is treated as
 * attacker-influenced, INCLUDING the roots themselves: `public/uploads` is a mount point, and a
 * mount point that turns out to be a symlink is a compromise, not a configuration detail. An
 * earlier version anchored on `realpath(public/uploads)`, which happily followed such a symlink
 * and served bytes from outside the volume.
 *
 * Containment is therefore established through DESCRIPTORS rather than through re-resolving a
 * pathname after the fact:
 *
 *   1. canonicalise `public` — the one path taken on trust;
 *   2. reject a root that is a symlink (`lstat`) before opening it;
 *   3. open the root with `O_DIRECTORY | O_NOFOLLOW`, so a symlink swapped in at that instant
 *      fails the open instead of being followed;
 *   4. ask the kernel what that descriptor actually refers to (`/proc/self/fd/<fd>` on Linux) and
 *      require it to be exactly `<canonical public>/<root>`;
 *   5. open the target once with `O_NOFOLLOW`;
 *   6. ask the kernel where THAT descriptor lives and require it to be inside the verified root;
 *   7. compare device/inode between the descriptor and the path on disk, so a swap performed
 *      between steps is detected rather than assumed away.
 *
 * This is detection plus atomic no-follow opens, not an openat(2)-style race-free traversal, which
 * Node does not expose. Every check fails closed. Where the kernel interface is unavailable
 * (non-Linux development machines) the fallback verifies the ancestor chain and the device/inode
 * pair explicitly, and is documented as weaker.
 */

export type AssetOpenResult =
  | { outcome: "opened"; handle: FileHandle; stats: Stats; contentType: string }
  | { outcome: "absent" }
  | { outcome: "unavailable"; operation: AssetOperation; code: string };

// Errors that mean "this asset is not here". Everything else is an operational fault that must not
// masquerade as missing content.
const ABSENCE_CODES = new Set(["ENOENT", "ENOTDIR", "ELOOP", "ENAMETOOLONG", "EISDIR"]);

const DELETED_SUFFIX = " (deleted)";

function isWithin(directory: string, target: string): boolean {
  return target === directory || target.startsWith(directory + path.sep);
}

/**
 * The path the kernel currently associates with an open descriptor, or null where that interface
 * does not exist. A descriptor whose file was unlinked while open reports `<path> (deleted)`; the
 * inode is still the one that was validated, so the marker is stripped and the request proceeds.
 */
async function descriptorPath(handle: FileHandle): Promise<string | null> {
  try {
    const link = await readlink(`/proc/self/fd/${handle.fd}`);

    return link.endsWith(DELETED_SUFFIX) ? link.slice(0, -DELETED_SUFFIX.length) : link;
  } catch {
    return null;
  }
}

/** Fallback containment for runtimes without `/proc/self/fd`: no ancestor may be a symlink. */
async function hasSymlinkedAncestor(anchor: string, filePath: string): Promise<boolean> {
  let current = path.dirname(filePath);

  while (isWithin(anchor, current) && current !== anchor) {
    const entry = await lstat(current).catch(() => null);

    if (!entry || entry.isSymbolicLink()) {
      return true;
    }

    current = path.dirname(current);
  }

  return false;
}

async function openVerifiedRoot(
  canonicalPublic: string,
  root: RuntimeAssetRoot,
): Promise<{ handle: FileHandle; realPath: string } | { operation: AssetOperation; code: string }> {
  const rootPath = path.join(canonicalPublic, root);
  const link = await lstat(rootPath).catch((error: unknown) => errorCode(error));

  if (typeof link === "string") {
    return { operation: "root", code: link };
  }

  if (link.isSymbolicLink()) {
    return { operation: "root", code: "EROOTSYMLINK" };
  }

  if (!link.isDirectory()) {
    return { operation: "root", code: "ENOTDIR" };
  }

  let handle: FileHandle;

  try {
    handle = await open(rootPath, fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW);
  } catch (error) {
    return { operation: "root", code: errorCode(error) };
  }

  const realPath = await descriptorPath(handle);

  // The root was not a symlink a moment ago and is not one now: if the descriptor points anywhere
  // other than the expected path, it was replaced in between.
  if (realPath !== null && realPath !== rootPath) {
    await handle.close().catch(() => undefined);

    return { operation: "root", code: "EROOTMOVED" };
  }

  return { handle, realPath: realPath ?? rootPath };
}

/**
 * Opens a runtime asset, or explains why it cannot be served. The caller owns the returned handle.
 */
export async function openRuntimeAsset(
  root: RuntimeAssetRoot,
  segments: readonly string[],
  baseDirectory: string,
): Promise<AssetOpenResult> {
  if (!hasSafeSegments(segments)) {
    return { outcome: "absent" };
  }

  const contentType = contentTypeFor(root, segments[segments.length - 1] ?? "");

  if (!contentType) {
    return { outcome: "absent" };
  }

  let canonicalPublic: string;

  try {
    canonicalPublic = await realpath(baseDirectory);
  } catch (error) {
    return { outcome: "unavailable", operation: "root", code: errorCode(error) };
  }

  const rootResult = await openVerifiedRoot(canonicalPublic, root);

  if (!("handle" in rootResult)) {
    return { outcome: "unavailable", operation: rootResult.operation, code: rootResult.code };
  }

  const { handle: rootHandle, realPath: verifiedRoot } = rootResult;
  // `verifiedRoot` is the descriptor-confirmed real path of `<cwd>/data/<root>`, which Turbopack
  // cannot prove statically. Without the marker it traces the whole project into the standalone
  // output; the marker only affects bundling, not the O_NOFOLLOW/containment checks below.
  const filePath = path.join(/*turbopackIgnore: true*/ verifiedRoot, ...segments);
  let handle: FileHandle;

  try {
    handle = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  } catch (error) {
    const code = errorCode(error);

    return ABSENCE_CODES.has(code)
      ? { outcome: "absent" }
      : { outcome: "unavailable", operation: "open", code };
  } finally {
    await rootHandle.close().catch(() => undefined);
  }

  try {
    const stats = await handle.stat();

    if (!stats.isFile()) {
      await handle.close().catch(() => undefined);

      return { outcome: "absent" };
    }

    const openedPath = await descriptorPath(handle);

    if (openedPath !== null) {
      // Descriptor-anchored: this is where the opened inode actually lives right now, so a
      // symlinked or swapped ancestor shows up as a path outside the verified root.
      if (!isWithin(verifiedRoot, openedPath)) {
        await handle.close().catch(() => undefined);

        return { outcome: "absent" };
      }
    } else if (await hasSymlinkedAncestor(verifiedRoot, filePath)) {
      await handle.close().catch(() => undefined);

      return { outcome: "absent" };
    }

    // A file unlinked after the open no longer has an entry; the descriptor still refers to the
    // inode that passed every check, so the in-flight request completes. A DIFFERENT inode at the
    // same path means a swap, and is refused.
    const onDisk = await lstat(openedPath ?? filePath).catch(() => null);

    if (onDisk && (onDisk.dev !== stats.dev || onDisk.ino !== stats.ino)) {
      await handle.close().catch(() => undefined);

      return { outcome: "absent" };
    }

    return { outcome: "opened", handle, stats, contentType };
  } catch (error) {
    await handle.close().catch(() => undefined);
    const code = errorCode(error);

    return ABSENCE_CODES.has(code)
      ? { outcome: "absent" }
      : { outcome: "unavailable", operation: "verify", code };
  }
}
