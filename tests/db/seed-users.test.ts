// @vitest-environment node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const SEED_PATH = resolve(__dirname, "../../db/seeds/001-users.ts");
const TSX_BIN = resolve(__dirname, "../../node_modules/.bin/tsx");

// A syntactically valid but unroutable URL: if validation did not stop the script first, the
// pool would fail to connect instead, which the assertions below would expose.
const UNREACHABLE_DATABASE_URL = "postgres://nobody:nothing@127.0.0.1:1/seed_contract_test";

function runSeed(env: Record<string, string>) {
  return spawnSync(TSX_BIN, [SEED_PATH], {
    encoding: "utf8",
    timeout: 30_000,
    env: { PATH: process.env.PATH ?? "", NODE_ENV: "development", DATABASE_URL: UNREACHABLE_DATABASE_URL, ...env },
  });
}

describe("db/seeds/001-users.ts", () => {
  test("tracks no reusable credential in the source", () => {
    const source = readFileSync(SEED_PATH, "utf8");

    expect(source).not.toContain("Infoseg");
    expect(source).not.toMatch(/password:\s*["'`]/);
  });

  test("refuses to run without explicit seed passwords", () => {
    const result = runSeed({});

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("SEED_ADMIN_PASSWORD");
    expect(result.stderr).toContain("SEED_STAFF_PASSWORD");
    expect(result.stdout).not.toMatch(/created|skipped/);
  });

  test("rejects a password shorter than 12 characters without echoing it", () => {
    const weak = "elevenchars";
    const result = runSeed({ SEED_ADMIN_PASSWORD: weak, SEED_STAFF_PASSWORD: "a-long-enough-password" });

    expect(weak).toHaveLength(11);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("SEED_ADMIN_PASSWORD");
    expect(`${result.stdout}${result.stderr}`).not.toContain(weak);
    expect(`${result.stdout}${result.stderr}`).not.toContain("a-long-enough-password");
  });

  test("still refuses to run in production even with valid passwords", () => {
    const result = runSeed({
      NODE_ENV: "production",
      SEED_ADMIN_PASSWORD: "a-long-enough-password",
      SEED_STAFF_PASSWORD: "another-long-password",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("production");
    expect(`${result.stdout}${result.stderr}`).not.toContain("a-long-enough-password");
  });
});
