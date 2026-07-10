// Vitest runs under Node, where the `server-only` specifier has no resolver. Next rewrites
// it during bundling; this stub stands in for it so repository modules stay importable
// from unit tests without weakening the build-time guard they carry in production.
export {};
