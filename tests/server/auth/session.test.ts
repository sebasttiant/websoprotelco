// @vitest-environment node
import { describe, expect, test, vi } from "vitest";

// session.ts imports `query` from "@/server/db/pool" for its DB-backed functions. These
// tests only exercise the pure token helpers below, but the module still has to load
// under vitest (which has no path-alias resolution), so the DB dependency is mocked
// rather than left to resolve for real.
vi.mock("@/server/db/pool", () => ({
  query: vi.fn(),
}));

import { generateSessionToken, hashSessionToken } from "../../../src/server/auth/session";

describe("generateSessionToken", () => {
  test("returns a base64url string", () => {
    const token = generateSessionToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("carries at least 32 bytes of entropy", () => {
    const token = generateSessionToken();
    const decodedLength = Buffer.from(token, "base64url").length;

    expect(decodedLength).toBeGreaterThanOrEqual(32);
  });

  test("differs across calls", () => {
    const first = generateSessionToken();
    const second = generateSessionToken();

    expect(first).not.toBe(second);
  });
});

describe("hashSessionToken", () => {
  test("is stable for the same token", () => {
    const token = generateSessionToken();

    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  test("differs for different tokens", () => {
    const first = generateSessionToken();
    const second = generateSessionToken();

    expect(hashSessionToken(first)).not.toBe(hashSessionToken(second));
  });

  test("never returns the token itself", () => {
    const token = generateSessionToken();

    expect(hashSessionToken(token)).not.toBe(token);
  });
});
