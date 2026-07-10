// @vitest-environment node
import { describe, expect, test } from "vitest";

import { profileUpdateInputSchema } from "@/domains/users/schemas";

describe("profileUpdateInputSchema", () => {
  test("parses a valid name-only input", () => {
    const result = profileUpdateInputSchema.parse({ name: "SOPROTELCO Buyer" });

    expect(result).toEqual({ name: "SOPROTELCO Buyer" });
  });

  test("strips a smuggled email field so a user cannot change their email through it", () => {
    // Zod's default object parsing drops unknown keys, so an "email" field never
    // survives into the parsed value and can never reach the update.
    const result = profileUpdateInputSchema.parse({
      name: "SOPROTELCO Buyer",
      email: "victim@soprotelco.test",
    });

    expect(result).toEqual({ name: "SOPROTELCO Buyer" });
    expect(result).not.toHaveProperty("email");
  });

  test("rejects a name that is too short", () => {
    const result = profileUpdateInputSchema.safeParse({ name: "J" });

    expect(result.success).toBe(false);
  });
});
