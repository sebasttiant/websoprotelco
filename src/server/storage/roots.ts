import "server-only";

import path from "node:path";

export const RUNTIME_ASSET_KINDS = {
  UPLOADS: "uploads",
  DOCUMENTS: "documents",
} as const;

export type RuntimeAssetKind = (typeof RUNTIME_ASSET_KINDS)[keyof typeof RUNTIME_ASSET_KINDS];

export interface RuntimeAssetRoots {
  uploads: string;
  documents: string;
}

export function runtimeAssetRoots(): RuntimeAssetRoots {
  const data = path.join(process.cwd(), "data");

  return { uploads: path.join(data, RUNTIME_ASSET_KINDS.UPLOADS), documents: path.join(data, RUNTIME_ASSET_KINDS.DOCUMENTS) };
}

export function runtimeAssetRoot(kind: RuntimeAssetKind): string {
  return runtimeAssetRoots()[kind];
}
