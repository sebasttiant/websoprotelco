import { describe, expect, test } from "vitest";

import { getE2eAdminCredentials } from "./e2e-admin";

const safeEnv = {
  DATABASE_URL: "postgresql://user:password@localhost:5432/websoprotelco_test",
  E2E_ADMIN_EMAIL: "e2e-admin@tests.invalid",
  E2E_ADMIN_PASSWORD: "test-only-password",
};

describe("E2E admin seed safety", () => {
  test("accepts explicit test-only credentials for a _test database", () => {
    expect(getE2eAdminCredentials(safeEnv)).toEqual({
      databaseUrl: safeEnv.DATABASE_URL,
      email: safeEnv.E2E_ADMIN_EMAIL,
      password: safeEnv.E2E_ADMIN_PASSWORD,
    });
  });

  test("rejects a production-like database before an E2E admin can be seeded", () => {
    expect(() => getE2eAdminCredentials({ ...safeEnv, DATABASE_URL: "postgresql://user:password@localhost:5432/websoprotelco" }))
      .toThrow("Refusing to use non-test database: websoprotelco");
  });

  test("rejects missing fixture credentials", () => {
    expect(() => getE2eAdminCredentials({ ...safeEnv, E2E_ADMIN_PASSWORD: "" }))
      .toThrow("E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required");
  });
});
