import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    passWithNoTests: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
    },
  },
});
