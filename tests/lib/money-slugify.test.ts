import { describe, expect, test } from "vitest";

import { centsToPesos, parsePesosInput, pesosToCents } from "@/lib/money";
import { slugifyName } from "@/lib/slugify";

describe("money helpers", () => {
  test("parses COP pesos with thousand separators and currency symbols", () => {
    expect(parsePesosInput("2.500.000")).toBe(2_500_000);
    expect(parsePesosInput("$ 250.000")).toBe(250_000);
    expect(parsePesosInput("4500000")).toBe(4_500_000);
  });

  test("converts pesos to stored centavos", () => {
    expect(pesosToCents(250_000)).toBe(25_000_000);
    expect(centsToPesos(25_000_000)).toBe(250_000);
  });
});

describe("slugifyName", () => {
  test("folds Spanish accents and spaces", () => {
    expect(slugifyName("Fusionadora Pro X1")).toBe("fusionadora-pro-x1");
    expect(slugifyName("Categoría Óptica")).toBe("categoria-optica");
  });
});
