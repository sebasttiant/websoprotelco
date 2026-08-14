import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const brandRoot = resolve(process.cwd(), "public/assets/img");
const primaryLogoPath = resolve(brandRoot, "sp-logo.png");
const reverseLogoPath = resolve(brandRoot, "sp-logo-white.png");
const globalsCss = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
const footerSource = readFileSync(resolve(process.cwd(), "src/components/layout/footer.tsx"), "utf8");
const adminLayoutSource = readFileSync(resolve(process.cwd(), "src/app/admin/layout.tsx"), "utf8");

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// The reverse mark is generated from the primary mark, so both are pinned: a silent swap of
// either one is what this contract exists to catch.
const PRIMARY = {
  sha256: "8f0d4d88fd1dd2242b154f7d34beeb6bc0ea36970e4a32e0435fb1881179b422",
  width: 394,
  height: 238,
};
const REVERSE = {
  sha256: "45a459a25bee470c827f9e1de190e17944da8887e00a3b209fbbc3db363750e0",
  width: 500,
  height: 302,
};

// Reading IHDR directly keeps this contract dependency-free: after the 8-byte signature and the
// IHDR length/type, bytes 16..24 are the width and height, big-endian.
function readPng(path: string) {
  const bytes = readFileSync(path);
  return {
    bytes,
    isSymlink: lstatSync(path).isSymbolicLink(),
    magic: bytes.subarray(0, 8),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

describe("brand asset safety contract", () => {
  test("keeps the approved primary mark byte-identical at its static brand path", () => {
    const logo = readPng(primaryLogoPath);

    expect(logo.isSymlink).toBe(false);
    expect(logo.magic).toEqual(PNG_MAGIC);
    expect(logo.width).toBe(PRIMARY.width);
    expect(logo.height).toBe(PRIMARY.height);
    expect(logo.sha256).toBe(PRIMARY.sha256);
  });

  test("keeps the approved reverse mark byte-identical at its static brand path", () => {
    const logo = readPng(reverseLogoPath);

    expect(logo.isSymlink).toBe(false);
    expect(logo.magic).toEqual(PNG_MAGIC);
    expect(logo.width).toBe(REVERSE.width);
    expect(logo.height).toBe(REVERSE.height);
    expect(logo.sha256).toBe(REVERSE.sha256);
  });

  // The reverse mark this replaced was sourced separately from a legacy site and sat 6% off the
  // primary mark's canvas proportions — 1.557 against 1.655 — so the two could never be aligned
  // with each other. Generating one from the other is what fixed it, and this assertion is what
  // stops a separately-sourced replacement from quietly reintroducing the drift.
  test("keeps the reverse mark in the same proportions as the primary mark", () => {
    const primary = readPng(primaryLogoPath);
    const reverse = readPng(reverseLogoPath);

    expect(Math.abs(primary.width / primary.height - reverse.width / reverse.height)).toBeLessThan(0.01);
  });

  // A mark shipped at thousands of pixels wide to render at 36-56px is pure transfer cost. The
  // previous reverse mark was 2924px wide and 147 KB, duplicated byte-for-byte into a second
  // directory, and both copies were served.
  test("ships brand marks sized for the slots that render them", () => {
    for (const path of [primaryLogoPath, reverseLogoPath]) {
      const logo = readPng(path);

      expect(logo.width).toBeLessThanOrEqual(1024);
      expect(logo.bytes.byteLength).toBeLessThanOrEqual(64 * 1024);
    }
  });

  test("points every consumer at the canonical brand path", () => {
    expect(footerSource).toContain("/assets/img/sp-logo-white.png");
    expect(adminLayoutSource).toContain("/assets/img/sp-logo-white.png");
    for (const source of [footerSource, adminLayoutSource]) {
      expect(source).not.toContain("/assets/brand/");
    }
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
    const brandSurface = [
      readFileSync(primaryLogoPath),
      readFileSync(reverseLogoPath),
      globalsCss,
      footerSource,
    ].join("\n");

    expect(brandSurface).not.toMatch(/supabase|data:image|base64/i);
  });
});
