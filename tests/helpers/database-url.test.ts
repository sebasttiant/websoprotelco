import { describe, expect, test } from "vitest";

import { assertTestDatabaseUrl, getDatabaseName } from "./database-url";

describe("database helper safety", () => {
  test("extracts the database name from a PostgreSQL URL", () => {
    expect(getDatabaseName("postgresql://user:password@localhost:5432/websoprotelco_test")).toBe(
      "websoprotelco_test",
    );
  });

  test("accepts PostgreSQL URLs targeting a _test database", () => {
    const connectionString = "postgresql://user:password@localhost:5432/websoprotelco_test";

    expect(assertTestDatabaseUrl(connectionString)).toBe(connectionString);
  });

  test("rejects PostgreSQL URLs targeting a non-test database", () => {
    expect(() => assertTestDatabaseUrl("postgresql://user:password@localhost:5432/websoprotelco")).toThrow(
      "Refusing to use non-test database: websoprotelco",
    );
  });

  test("rejects protected PostgreSQL maintenance databases", () => {
    expect(() => assertTestDatabaseUrl("postgresql://user:password@localhost:5432/postgres")).toThrow(
      "Refusing to use non-test database: postgres",
    );
  });

  test("accepts the postgres:// scheme alias", () => {
    const connectionString = "postgres://user:password@localhost:5432/websoprotelco_test";

    expect(assertTestDatabaseUrl(connectionString)).toBe(connectionString);
  });

  test("rejects a database name containing a slash", () => {
    expect(() => assertTestDatabaseUrl("postgresql://user:password@localhost:5432/a/b_test")).toThrow(
      "Refusing to use non-test database: a/b_test",
    );
  });
});
