// @vitest-environment node
import { describe, expect, test } from "vitest";

import { hashPassword, verifyPassword } from "../../../src/server/auth/password";

const VALID_PASSWORD = "correct horse battery";

describe("hashPassword", () => {
  test("returns a scrypt-tagged hash, not the plaintext", async () => {
    const hash = await hashPassword(VALID_PASSWORD);

    expect(hash).not.toBe(VALID_PASSWORD);
    expect(hash.startsWith("scrypt$")).toBe(true);
  });

  test("produces a different hash for the same password on each call", async () => {
    const first = await hashPassword(VALID_PASSWORD);
    const second = await hashPassword(VALID_PASSWORD);

    expect(first).not.toBe(second);
  });

  test("throws for a password shorter than 12 characters", async () => {
    await expect(hashPassword("x".repeat(11))).rejects.toThrow();
  });

  test("throws for a password longer than 200 characters", async () => {
    await expect(hashPassword("a".repeat(201))).rejects.toThrow();
  });

  test("accepts a password at the 12 and 200 character boundaries", async () => {
    await expect(hashPassword("a".repeat(12))).resolves.toEqual(expect.any(String));
    await expect(hashPassword("a".repeat(200))).resolves.toEqual(expect.any(String));
  });
});

describe("verifyPassword", () => {
  test("returns true for the right password", async () => {
    const hash = await hashPassword(VALID_PASSWORD);

    await expect(verifyPassword(VALID_PASSWORD, hash)).resolves.toBe(true);
  });

  test("returns false for the wrong password", async () => {
    const hash = await hashPassword(VALID_PASSWORD);

    await expect(verifyPassword("wrong password entirely", hash)).resolves.toBe(false);
  });

  test.each([
    ["an empty stored value", ""],
    ["garbage", "garbage"],
    ["a truncated scrypt tag", "scrypt$bad"],
    ["an unknown algorithm", "argon2$16384$8$1$c2FsdA==$aGFzaA=="],
  ])("returns false (never throws) for %s", async (_label, stored) => {
    await expect(verifyPassword(VALID_PASSWORD, stored)).resolves.toBe(false);
  });

  test("returns false (never throws) for a hash with a truncated key", async () => {
    const hash = await hashPassword(VALID_PASSWORD);
    const truncated = hash.slice(0, hash.length - 10);

    await expect(verifyPassword(VALID_PASSWORD, truncated)).resolves.toBe(false);
  });
});
