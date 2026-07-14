import { describe, expect, test } from "vitest";

import packageJson from "../../package.json";

describe("runtime foundation", () => {
  test("aligns package manager and runtime metadata", () => {
    expect(packageJson.packageManager).toBe("pnpm@11.9.0");
    expect(packageJson.engines.node).toBe("24.16.0");
    expect(packageJson.dependencies.next).toBe("16.2.10");
    expect(packageJson.dependencies.react).toBe("19.2.7");
  });
});
