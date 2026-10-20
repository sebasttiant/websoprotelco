import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // Mirrors the tsconfig paths. Without this, a `vi.mock("@/...")` silently fails to
  // intercept a module that the code under test imported by a relative specifier.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@tests": fileURLToPath(new URL("./tests", import.meta.url)),
      // Next rewrites this specifier when bundling; Vitest runs under Node and cannot.
      "server-only": fileURLToPath(new URL("./tests/helpers/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    passWithNoTests: false,
    // Reporting only, on purpose: there is no global threshold. A repository-wide percentage rewards
    // easy lines and says nothing about the critical paths (authorization, uploads, deploy), which
    // are pinned by named tests instead. `include` makes untested files show up as 0% rather than
    // vanish from the report.
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      reportsDirectory: "coverage",
    },
  },
});
