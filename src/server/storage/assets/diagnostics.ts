import type { RuntimeAssetRoot } from "./policy";

/**
 * Sanitized, structured diagnostics for asset delivery.
 *
 * Storage paths and stored filenames are user-influenced and identify customer content, so neither
 * ever reaches a log line or a response body. What is emitted is the fixed root name, the
 * operation, and the errno — enough to tell "the uploads volume went read-only" apart from "that
 * document was deleted" in production, and nothing more.
 */
export type AssetOperation = "root" | "open" | "verify" | "read" | "stream" | "probe";

export function errorCode(error: unknown): string {
  if (error instanceof Error && "code" in error) {
    return String((error as NodeJS.ErrnoException).code);
  }

  return error instanceof Error ? error.name : "UNKNOWN";
}

export function logAssetFailure(root: RuntimeAssetRoot, operation: AssetOperation, code: string): void {
  console.error(`[runtime-assets] root=${root} operation=${operation} code=${code}`);
}
