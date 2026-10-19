import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const nextConfigSource = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");

describe("security headers", () => {
  test("keeps the Next.js powered-by header off", () => {
    expect(nextConfigSource).toMatch(/poweredByHeader:\s*false/);
  });

  test("applies baseline browser hardening on every path", () => {
    expect(nextConfigSource).toContain('source: "/:path*"');
    expect(nextConfigSource).toContain("X-Content-Type-Options");
    expect(nextConfigSource).toContain("X-Frame-Options");
    expect(nextConfigSource).toContain("Referrer-Policy");
    expect(nextConfigSource).toContain("Permissions-Policy");
  });

  test("forces document downloads instead of inline render", () => {
    expect(nextConfigSource).toContain('source: "/documents/:path*"');
    expect(nextConfigSource).toContain('Content-Disposition", value: "attachment"');
  });
});
