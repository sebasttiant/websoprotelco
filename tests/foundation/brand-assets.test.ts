import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const brandRoot = resolve(process.cwd(), "public/assets/brand");
const imgRoot = resolve(process.cwd(), "public/assets/img");
const logoWhitePath = resolve(brandRoot, "soprotelco-logo-white.png");
const logoLightPath = resolve(imgRoot, "sp-logo.png");
const logoDarkPath = resolve(imgRoot, "sp-logo-white.png");
const globalsCss = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
const footerSource = readFileSync(resolve(process.cwd(), "src/components/layout/footer.tsx"), "utf8");
const brandLogoSource = readFileSync(resolve(process.cwd(), "src/components/brand/brand-logo.tsx"), "utf8");
const APPROVED_LOGO_WHITE_SHA256 =
  "1cfe1120c6ef54b8232c122ab18bb0e510a9fbfd325654543e1dcbe9e3453081";
const APPROVED_LOGO_LIGHT_SHA256 =
  "6e4f35fc2ce89ca0cf880fbec9b8d6db4c7f96b99c3f5535ab530d492d417291";
const APPROVED_LOGO_DIMENSIONS = { width: 394, height: 238 };

function assertPng(path: string, sha256: string) {
  const logo = readFileSync(path);

  expect(lstatSync(path).isSymbolicLink()).toBe(false);
  expect(logo.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  expect(logo.readUInt32BE(16)).toBe(APPROVED_LOGO_DIMENSIONS.width);
  expect(logo.readUInt32BE(20)).toBe(APPROVED_LOGO_DIMENSIONS.height);
  expect(createHash("sha256").update(logo).digest("hex")).toBe(sha256);
}

describe("brand asset safety contract", () => {
  test("keeps the legacy approved SOPROTELCO PNGs byte-identical at their static paths", () => {
    assertPng(logoWhitePath, APPROVED_LOGO_WHITE_SHA256);
    assertPng(logoLightPath, APPROVED_LOGO_LIGHT_SHA256);
    assertPng(logoDarkPath, APPROVED_LOGO_WHITE_SHA256);
    expect(footerSource).toContain("BrandLogo");
  });

  test("serves the client-approved vector logos traced from the same artwork", () => {
    const lightSvg = readFileSync(resolve(brandRoot, "soprotelco-logo.svg"), "utf8");
    const darkSvg = readFileSync(resolve(brandRoot, "soprotelco-logo-white.svg"), "utf8");

    for (const svg of [lightSvg, darkSvg]) {
      expect(svg).toContain('viewBox="0 0 394 238"');
      expect(svg).toContain('fill="#0f4c81"');
      expect(svg).not.toMatch(/<image|data:image|base64/i);
    }
    expect(darkSvg).toContain('fill="#7cf3ff"');
    expect(brandLogoSource).toContain("/assets/brand/soprotelco-logo.svg");
    expect(brandLogoSource).toContain("/assets/brand/soprotelco-logo-white.svg");
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
    const brandSurface = [readFileSync(logoWhitePath), globalsCss, footerSource, brandLogoSource].join("\n");

    expect(brandSurface).not.toMatch(/supabase|data:image|base64/i);
  });
});
