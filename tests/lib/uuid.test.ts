import { describe, expect, test } from "vitest";

import { isUuid } from "@/lib/uuid";

describe("isUuid", () => {
  test("accepts a well-formed UUID", () => {
    expect(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
  });

  test("rejects a non-UUID route parameter", () => {
    // This is the exact value that would otherwise reach Postgres and throw
    // "invalid input syntax for type uuid", 500-ing the admin page.
    expect(isUuid("not-a-uuid")).toBe(false);
  });

  test("rejects empty and whitespace", () => {
    expect(isUuid("")).toBe(false);
    expect(isUuid("   ")).toBe(false);
  });

  test("rejects a UUID with surrounding text", () => {
    expect(isUuid("id=3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(false);
  });
});
