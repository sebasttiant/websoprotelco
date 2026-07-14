import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const globalsCss = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

const themeBlock = (() => {
  const match = globalsCss.match(/@theme\s*\{([\s\S]*?)\n\}/);
  if (!match) throw new Error("globals.css is missing its @theme block");
  return match[1];
})();

function themeToken(name: string): string | undefined {
  const match = themeBlock.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return match?.[1].trim();
}

describe("design tokens", () => {
  test("exposes the brand palette as Tailwind theme tokens", () => {
    expect(themeToken("color-brand-navy")).toBe("#0c1a2a");
    expect(themeToken("color-brand-primary")).toBe("#0f4c81");
    expect(themeToken("color-brand-blue")).toBe("#1b6eac");
    expect(themeToken("color-brand-ice")).toBe("#f8fafc");
    expect(themeToken("color-brand-muted")).toBe("#5e6c80");
    expect(themeToken("color-brand-line")).toBe("#dbe6f3");
  });

  test("exposes the cyan accent scale used for highlights and glows", () => {
    expect(themeToken("color-brand-accent")).toBe("#06d3f9");
    expect(themeToken("color-brand-accent-soft")).toBe("#7cf3ff");
  });

  test("derives the accent glow shadow from the accent token", () => {
    expect(themeToken("shadow-glow")).toContain("--color-brand-accent");
  });

  test("routes the sans stack through the Inter font variable", () => {
    expect(themeToken("font-sans")).toContain("var(--font-inter)");
  });

  test("lets body inherit typography from the theme instead of hardcoding it", () => {
    expect(globalsCss).not.toMatch(/font-family:\s*Arial/i);
  });
});
