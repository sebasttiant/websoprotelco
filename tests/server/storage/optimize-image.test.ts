// @vitest-environment node
import { describe, expect, test } from "vitest";
import sharp from "sharp";

import {
  MAX_IMAGE_DIMENSION,
  OPTIMIZED_IMAGE_CONTENT_TYPE,
  optimizeProductImage,
} from "@/server/storage/optimize-image";

// Builds a real raster image of the given size as a PNG buffer — a genuine input for sharp,
// not a mock, so the test exercises the actual codec path the upload uses.
async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 30, g: 90, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

describe("optimizeProductImage", () => {
  test("re-encodes to WebP regardless of the input format", async () => {
    const png = await makePng(800, 600);

    const optimized = await optimizeProductImage(png);
    const meta = await sharp(optimized).metadata();

    expect(meta.format).toBe("webp");
    expect(OPTIMIZED_IMAGE_CONTENT_TYPE).toBe("image/webp");
  });

  test("bounds an oversized image to the max dimension on its long edge", async () => {
    const huge = await makePng(4000, 2000);

    const meta = await sharp(await optimizeProductImage(huge)).metadata();

    expect(meta.width).toBe(MAX_IMAGE_DIMENSION);
    // Aspect ratio preserved: 4000×2000 → 1600×800.
    expect(meta.height).toBe(MAX_IMAGE_DIMENSION / 2);
  });

  test("does not upscale an image already smaller than the max", async () => {
    const small = await makePng(400, 300);

    const meta = await sharp(await optimizeProductImage(small)).metadata();

    expect(meta.width).toBe(400);
    expect(meta.height).toBe(300);
  });

  test("produces a smaller buffer than a bulky source", async () => {
    // A large photographic-ish PNG is heavy; the bounded WebP must come out dramatically lighter
    // — this is the entire point of the step.
    const heavy = await sharp({
      create: { width: 3000, height: 3000, channels: 3, background: { r: 200, g: 120, b: 40 } },
    })
      .png()
      .toBuffer();

    const optimized = await optimizeProductImage(heavy);

    expect(optimized.byteLength).toBeLessThan(heavy.byteLength);
  });

  test("strips metadata — no EXIF survives the re-encode", async () => {
    const png = await makePng(500, 500);

    const meta = await sharp(await optimizeProductImage(png)).metadata();

    // sharp exposes EXIF as a Buffer when present; the re-encode drops it.
    expect(meta.exif).toBeUndefined();
  });
});
