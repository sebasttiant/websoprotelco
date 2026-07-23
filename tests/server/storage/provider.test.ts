import { afterEach, describe, expect, test } from "vitest";

import { checkStorageConfiguration, createStorageAdapter, readStorageProvider } from "@/server/storage";

const CONFIG_ERROR = "Invalid storage environment configuration";

afterEach(() => {
  delete process.env.STORAGE_PROVIDER;
});

describe("storage provider selection", () => {
  test("accepts the supported local provider", () => {
    expect(readStorageProvider({ STORAGE_PROVIDER: "local", NODE_ENV: "production" })).toBe("local");
  });

  test("fails closed for an unknown provider", () => {
    expect(() => readStorageProvider({ STORAGE_PROVIDER: "s3", NODE_ENV: "production" })).toThrow(CONFIG_ERROR);
  });

  test("fails closed in production when STORAGE_PROVIDER is absent", () => {
    expect(() => readStorageProvider({ NODE_ENV: "production" })).toThrow(CONFIG_ERROR);
  });

  test("allows the implicit local default only outside production", () => {
    expect(readStorageProvider({ NODE_ENV: "development" })).toBe("local");
    expect(readStorageProvider({ NODE_ENV: "test" })).toBe("local");
  });

  test("adapter creation rejects an unknown provider instead of using local storage", async () => {
    process.env.STORAGE_PROVIDER = "s3";

    await expect(createStorageAdapter()).rejects.toThrow(CONFIG_ERROR);
  });
});

describe("storage configuration probe", () => {
  test("reports the configured provider when storage is usable", async () => {
    process.env.STORAGE_PROVIDER = "local";

    await expect(checkStorageConfiguration()).resolves.toEqual({ ok: true, provider: "local" });
  });

  test("reports a failure without echoing the rejected configured value", async () => {
    process.env.STORAGE_PROVIDER = "s3";

    const result = await checkStorageConfiguration();

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("s3");
  });
});
