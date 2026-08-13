// Stable stand-in for the generated `next-env.d.ts`, which `tsconfig.json` excludes.
//
// `next typegen` rewrites `next-env.d.ts` on every run and bakes the active `distDir` into its
// `import "./<distDir>/types/routes.d.ts"` line, so pointing the program at that tracked file
// makes typecheck results depend on whichever Next command ran last. This file carries the same
// ambient references and never changes. The generated route types reach the program through the
// `.next-typecheck/.next/types/**/*.ts` include instead of an import, so they are still checked
// without binding a tracked file to a generated path.
/// <reference types="next" />
/// <reference types="next/image-types/global" />
