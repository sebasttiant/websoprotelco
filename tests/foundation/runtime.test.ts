import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import packageJson from "../../package.json";

describe("runtime foundation", () => {
  test("aligns package manager and runtime metadata", () => {
    expect(packageJson.packageManager).toBe("pnpm@12.14.0");
    expect(packageJson.engines.node).toBe("24.22.0");
    expect(packageJson.dependencies.next).toBe("16.4.2");
    expect(packageJson.dependencies.react).toBe("19.3.1");
    // TS 7 breaks eslint-config-next's typescript-eslint peers; stay on latest 6.x.
    expect(packageJson.devDependencies.typescript).toBe("6.0.3");
    expect(packageJson.dependencies.sharp).toBe("0.35.5");
  });

  test("keeps the Dockerfile sharp install pinned to package.json", () => {
    const dockerfile = readFileSync(resolve(process.cwd(), "Dockerfile"), "utf8");
    expect(dockerfile).toContain(`sharp@${packageJson.dependencies.sharp}`);
    expect(dockerfile).toContain(`node:${packageJson.engines.node}-`);
  });
});
