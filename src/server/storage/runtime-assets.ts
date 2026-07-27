import "server-only";

import { constants } from "node:fs";
import { access, lstat, open } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { runtimeAssetRoot, type RuntimeAssetKind } from "./roots";

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
const UPLOAD_TYPES = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" } as const;
const DOCUMENT_CATEGORIES = new Set(["manual", "datasheet", "certificate", "warranty", "other"]);

type AssetType = string | undefined;

function typeFor(kind: RuntimeAssetKind, segments: string[]): AssetType {
  if (!segments.every((segment) => SEGMENT.test(segment))) return undefined;
  const extension = path.extname(segments.at(-1) ?? "");
  if (kind === "uploads") return (segments.length === 1 || (segments.length === 2 && ["banners", "hero"].includes(segments[0]))) ? UPLOAD_TYPES[extension as keyof typeof UPLOAD_TYPES] : undefined;
  return segments.length === 2 && DOCUMENT_CATEGORIES.has(segments[0]) && extension === ".pdf" ? "application/pdf" : undefined;
}

async function trustedDirectory(directory: string): Promise<boolean> {
  try {
    const info = await lstat(directory);
    return info.isDirectory() && !info.isSymbolicLink();
  } catch {
    return false;
  }
}

async function safeTarget(root: string, segments: string[]): Promise<string | undefined> {
  if (!(await trustedDirectory(root))) return undefined;
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) return undefined;
    } catch (error) {
      if (["ENOENT", "ENOTDIR", "ELOOP"].includes((error as NodeJS.ErrnoException).code ?? "")) return current;
      throw error;
    }
  }
  return current;
}

function unavailable(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return !["ENOENT", "ENOTDIR", "ELOOP"].includes(code ?? "");
}

export async function serveRuntimeAsset(kind: RuntimeAssetKind, segments: string[]): Promise<Response> {
  const contentType = typeFor(kind, segments);
  const root = runtimeAssetRoot(kind);
  if (!contentType) return new Response(null, { status: 404 });
  let target: string | undefined;
  try {
    target = await safeTarget(root, segments);
  } catch {
    return new Response(null, { status: 503 });
  }
  if (!target) return new Response(null, { status: (await trustedDirectory(root)) ? 404 : 503 });

  let handle;
  try {
    handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile()) {
      await handle.close();
      return new Response(null, { status: 404 });
    }
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined);
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response(null, { status: (await trustedDirectory(root)) ? 404 : 503 });
    return new Response(null, { status: unavailable(error) ? 503 : 404 });
  }

  let stream;
  try {
    stream = handle.createReadStream({ autoClose: true });
  } catch {
    await handle.close().catch(() => undefined);
    return new Response(null, { status: 503 });
  }
  try {
    const headers = new Headers({ "Content-Type": contentType, "X-Content-Type-Options": "nosniff" });
    if (kind === "documents") headers.set("Content-Disposition", "attachment");
    return new Response(Readable.toWeb(stream) as ReadableStream, { headers });
  } catch {
    stream.destroy();
    return new Response(null, { status: 503 });
  }
}

export async function checkRuntimeAssetRoots(): Promise<void> {
  const { uploads, documents } = await import("./roots").then(({ runtimeAssetRoots }) => runtimeAssetRoots());
  if (!(await trustedDirectory(uploads)) || !(await trustedDirectory(documents))) throw new Error("Runtime asset roots are unavailable.");
  await Promise.all([
    access(uploads, constants.W_OK | constants.X_OK),
    access(documents, constants.W_OK | constants.X_OK),
  ]);
}
