import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const brandRoot = resolve(process.cwd(), "public/assets/brand");
const logoPath = resolve(brandRoot, "soprotelco-logo-white.png");
const globalsCss = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
const footerSource = readFileSync(resolve(process.cwd(), "src/components/layout/footer.tsx"), "utf8");
const APPROVED_LOGO_SHA256 = "17a2ff85ed9c58ece86b4c0260ddb49c624413f59d1dabcaa7d0d47efdc30f26";
const APPROVED_LOGO_DIMENSIONS = { width: 2924, height: 1878 };

describe("brand asset safety contract", () => {
  test("keeps the approved SOPROTELCO logo byte-identical at its static brand path", () => {
    const logo = readFileSync(logoPath);

    expect(lstatSync(logoPath).isSymbolicLink()).toBe(false);
    expect(logo.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(logo.readUInt32BE(16)).toBe(APPROVED_LOGO_DIMENSIONS.width);
    expect(logo.readUInt32BE(20)).toBe(APPROVED_LOGO_DIMENSIONS.height);
    expect(createHash("sha256").update(logo).digest("hex")).toBe(APPROVED_LOGO_SHA256);
    expect(footerSource).toContain("/assets/brand/soprotelco-logo-white.png");
  });

  test("keeps the selective legacy palette and Inter typography in the global theme", () => {
    expect(globalsCss).toContain("--color-brand-navy: #0c1a2a");
    expect(globalsCss).toContain("--color-brand-primary: #0f4c81");
    expect(globalsCss).toContain("--color-brand-blue: #1b6eac");
    expect(globalsCss).toContain("--color-brand-accent: #06d3f9");
    expect(globalsCss).toContain("--font-sans: var(--font-inter)");
  });

  test("keeps the evidenced legacy typography, surface, and spacing foundation", () => {
    expect(globalsCss).toContain("--color-brand-bg: #f4f7fc");
    expect(globalsCss).toContain("--color-brand-surface: #fff");
    expect(globalsCss).toContain("--color-brand-ink: #0a1728");
    expect(globalsCss).toContain("--color-brand-border: #e0e8f2");
    expect(globalsCss).toContain("--spacing-brand-3-5: 0.875rem");
    expect(globalsCss).toContain("--spacing-brand-4-5: 1.125rem");
    expect(globalsCss).toContain("font-size: 16.5px");
    expect(globalsCss).toContain("line-height: 1.6");
    expect(globalsCss).toContain("font-weight: 500");
  });

  test("excludes unsafe integration and encoded-data coupling from the brand surface", () => {
    const brandSurface = [readFileSync(logoPath), globalsCss, footerSource].join("\n");

    expect(brandSurface).not.toMatch(/supabase|data:image|base64/i);
  });
});
