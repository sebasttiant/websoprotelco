import { describe, expect, test } from "vitest";

import { initialsFrom, paletteIndexFor } from "@/components/admin/initial-avatar";

describe("initialsFrom", () => {
  test("takes the first letter of each of the first two words", () => {
    expect(initialsFrom("Fusionadora Compacta")).toBe("FC");
  });

  test("takes the first two letters of a single word", () => {
    expect(initialsFrom("Switch")).toBe("SW");
  });

  test("ignores non-letters so a leading number does not become the initials", () => {
    // "10/100M SM" — the first alphanumeric word is "10100M", the second "SM".
    expect(initialsFrom("Conversor 10/100M SM")).toBe("C1");
  });

  test("uppercases regardless of input case", () => {
    expect(initialsFrom("patch cords")).toBe("PC");
  });

  test("falls back to a placeholder for an empty or symbol-only name", () => {
    expect(initialsFrom("")).toBe("?");
    expect(initialsFrom("—")).toBe("?");
  });
});

describe("paletteIndexFor", () => {
  test("stays within the palette bounds", () => {
    for (const seed of ["SKU-1", "FUS", "", "a very long product name here"]) {
      const index = paletteIndexFor(seed, 8);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(8);
    }
  });

  test("is deterministic — the same seed always maps to the same colour", () => {
    expect(paletteIndexFor("FUS", 8)).toBe(paletteIndexFor("FUS", 8));
  });

  test("distinguishes SKUs that share a prefix, where a char-sum would collide", () => {
    // "SW01" and "SW10" have the same character sum; the 31-multiplier hash separates them.
    expect(paletteIndexFor("SW01", 8)).not.toBe(paletteIndexFor("SW10", 8));
  });
});
