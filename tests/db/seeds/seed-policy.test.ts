import { describe, expect, test } from "vitest";

import { getSeedUsers, type SeedEnvironment } from "../../../db/seeds/seed-policy";

const LOCAL_SEED_ENV: SeedEnvironment = {
  NODE_ENV: "development",
  ALLOW_LOCAL_SEED_USERS: "true",
  LOCAL_SEED_ADMIN_EMAIL: "Admin@local.test",
  LOCAL_SEED_ADMIN_PASSWORD: "test-only-admin-password",
  LOCAL_SEED_STAFF_EMAIL: "Staff@local.test",
  LOCAL_SEED_STAFF_PASSWORD: "test-only-staff-password",
};

describe("getSeedUsers", () => {
  test("requires operator-supplied local credentials", () => {
    expect(() => getSeedUsers({ ...LOCAL_SEED_ENV, LOCAL_SEED_ADMIN_PASSWORD: "" }))
      .toThrow("LOCAL_SEED_ADMIN_PASSWORD is required");
  });

  test.each(["production", "staging"]) ("refuses %s even when credentials are supplied", (environment) => {
    expect(() => getSeedUsers({ ...LOCAL_SEED_ENV, NODE_ENV: environment }))
      .toThrow("Refusing to seed users outside NODE_ENV=development or NODE_ENV=test");
  });

  test("refuses development seed users without an explicit local opt-in", () => {
    expect(() => getSeedUsers({ ...LOCAL_SEED_ENV, ALLOW_LOCAL_SEED_USERS: undefined }))
      .toThrow("Refusing to seed development users without ALLOW_LOCAL_SEED_USERS=true");
  });

  test("accepts operator-supplied development credentials with an explicit local opt-in", () => {
    expect(getSeedUsers(LOCAL_SEED_ENV)).toEqual([
      { email: "admin@local.test", password: "test-only-admin-password", role: "admin" },
      { email: "staff@local.test", password: "test-only-staff-password", role: "staff" },
    ]);
  });
});
