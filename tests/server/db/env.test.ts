// @vitest-environment node
import { describe, expect, test } from "vitest";

import { readDatabaseEnv } from "../../../src/server/db/env";

const validUrl = "postgresql://user:super-secret-password@localhost:5432/websoprotelco";

function makeEnv(overrides: Partial<NodeJS.ProcessEnv>): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...overrides };
}

// Asserting the message prefix rather than "throws at all" is what distinguishes a
// rejected value from an unhandled TypeError escaping the validation layer.
function expectConfigurationError(source: NodeJS.ProcessEnv): Error {
  let thrown: unknown;

  try {
    readDatabaseEnv(source);
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(Error);
  const error = thrown as Error;
  expect(error.constructor).toBe(Error);
  expect(error.message).toMatch(/^Invalid database environment configuration: /);

  return error;
}

describe("readDatabaseEnv", () => {
  test("accepts a postgresql:// DSN", () => {
    const env = readDatabaseEnv(makeEnv({ DATABASE_URL: validUrl }));

    expect(env.DATABASE_URL).toBe(validUrl);
  });

  test("accepts a postgres:// DSN", () => {
    const url = "postgres://user:password@localhost:5432/websoprotelco";
    const env = readDatabaseEnv(makeEnv({ DATABASE_URL: url }));

    expect(env.DATABASE_URL).toBe(url);
  });

  test("rejects a mysql:// DSN", () => {
    const error = expectConfigurationError(makeEnv({ DATABASE_URL: "mysql://user:password@localhost:3306/db" }));

    expect(error.message).toContain("DATABASE_URL");
  });

  test("rejects an empty string", () => {
    expectConfigurationError(makeEnv({ DATABASE_URL: "" }));
  });

  test("rejects non-URL garbage without leaking a raw TypeError", () => {
    expectConfigurationError(makeEnv({ DATABASE_URL: "not-a-url" }));
  });

  test("rejects a missing DATABASE_URL", () => {
    expectConfigurationError(makeEnv({}));
  });

  test("defaults DATABASE_POOL_MAX to 10 and DATABASE_SSL to disable", () => {
    const env = readDatabaseEnv(makeEnv({ DATABASE_URL: validUrl }));

    expect(env.DATABASE_POOL_MAX).toBe(10);
    expect(env.DATABASE_SSL).toBe("disable");
  });

  test("coerces DATABASE_POOL_MAX from a numeric string", () => {
    const env = readDatabaseEnv(makeEnv({ DATABASE_URL: validUrl, DATABASE_POOL_MAX: "25" }));

    expect(env.DATABASE_POOL_MAX).toBe(25);
  });

  test.each(["0", "-1", "abc", "101"])("rejects DATABASE_POOL_MAX=%s", (value) => {
    expectConfigurationError(makeEnv({ DATABASE_URL: validUrl, DATABASE_POOL_MAX: value }));
  });

  test("rejects an unsupported DATABASE_SSL value", () => {
    expectConfigurationError(makeEnv({ DATABASE_URL: validUrl, DATABASE_SSL: "verify-full" }));
  });

  test.each([
    ["rejected scheme", "mysql://user:super-secret-password@localhost:3306/db"],
    ["malformed url", "super-secret-password"],
  ])("never leaks the connection string or password for a %s", (_label, databaseUrl) => {
    const error = expectConfigurationError(makeEnv({ DATABASE_URL: databaseUrl }));

    expect(error.message).not.toContain("super-secret-password");
    expect(error.message).not.toContain(databaseUrl);
  });
});
