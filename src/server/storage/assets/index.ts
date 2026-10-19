/**
 * Public surface of runtime asset delivery — the files written into `public/` after the server has
 * booted, which Next's boot-time public-file index cannot see.
 *
 * Route handlers and the storage health check import from here; the internals (policy, containment,
 * HTTP semantics, streaming, probing) live in sibling modules.
 */
export { RUNTIME_ASSET_ROOTS, type RuntimeAssetRoot } from "./policy";
export { serveRuntimeAsset } from "./serve";
export { probeRuntimeAssetRoots, type RuntimeAssetProbeResult } from "./probe";
