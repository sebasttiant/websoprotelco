// @vitest-environment node
import { describe, expect, test } from "vitest";
import sharp from "sharp";

import {
  ImageProcessingError,
  isWithinSourcePixelBudget,
  MAX_DESIGN_IMAGE_DIMENSION,
  MAX_IMAGE_DIMENSION,
  MAX_SOURCE_PIXELS,
  OPTIMIZED_IMAGE_CONTENT_TYPE,
  optimizeDesignImage,
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

  test("returns a handled error for a truncated payload with a valid PNG prefix", async () => {
    const png = await makePng(200, 200);
    const truncated = Buffer.from(png.subarray(0, 24));

    await expect(optimizeProductImage(truncated)).rejects.toBeInstanceOf(ImageProcessingError);
  });

  test("pixel budget refuses absurd source dimensions without allocating them", () => {
    expect(isWithinSourcePixelBudget(4000, 3000)).toBe(true);
    expect(isWithinSourcePixelBudget(10_000, 10_000)).toBe(false);
    expect(10_000 * 10_000).toBeGreaterThan(MAX_SOURCE_PIXELS);
  });

  test("punches a uniform light studio backdrop to alpha and trims empty margins", async () => {
    // White frame with a solid navy rectangle inset — the classic lightbox product shot.
    const source = await sharp({
      create: { width: 200, height: 200, channels: 3, background: { r: 250, g: 250, b: 250 } },
    })
      .composite([
        {
          input: await sharp({
            create: { width: 80, height: 80, channels: 3, background: { r: 10, g: 40, b: 120 } },
          })
            .png()
            .toBuffer(),
          left: 60,
          top: 60,
        },
      ])
      .png()
      .toBuffer();

    const optimized = await optimizeProductImage(source);
    const webpMeta = await sharp(optimized).metadata();
    expect(webpMeta.format).toBe("webp");
    // White margins punched to alpha then trimmed away → subject box (~80×80), not the 200×200 frame.
    expect(webpMeta.width).toBe(80);
    expect(webpMeta.height).toBe(80);
  });

  test("keeps alpha on a circular subject whose bounding box still has transparent corners", async () => {
    const circle = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
         <rect width="200" height="200" fill="rgb(250,250,250)"/>
         <circle cx="100" cy="100" r="50" fill="rgb(10,40,120)"/>
       </svg>`,
    );
    const source = await sharp(circle).png().toBuffer();

    const optimized = await optimizeProductImage(source);
    const meta = await sharp(optimized).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.hasAlpha).toBe(true);
    expect(meta.width).toBeLessThan(200);

    const { data } = await sharp(optimized).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] === 0) transparent += 1;
    }
    expect(transparent).toBeGreaterThan(0);
  });

  test("leaves a busy-border photo opaque instead of inventing transparency", async () => {
    const left = await sharp({
      create: { width: 100, height: 200, channels: 3, background: { r: 250, g: 250, b: 250 } },
    })
      .png()
      .toBuffer();
    const right = await sharp({
      create: { width: 100, height: 200, channels: 3, background: { r: 40, g: 120, b: 200 } },
    })
      .png()
      .toBuffer();
    const busy = await sharp({
      create: { width: 200, height: 200, channels: 3, background: { r: 128, g: 128, b: 128 } },
    })
      .composite([
        { input: left, left: 0, top: 0 },
        { input: right, left: 100, top: 0 },
      ])
      .png()
      .toBuffer();

    const optimized = await optimizeProductImage(busy);
    const meta = await sharp(optimized).metadata();

    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(200);

    const { data } = await sharp(optimized).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] === 0) transparent += 1;
    }
    // Busy borders must not invent transparency holes in the subject.
    expect(transparent).toBe(0);
  });
});

describe("optimizeDesignImage", () => {
  test("allows a wider long edge than catalog product images", async () => {
    const wide = await makePng(3000, 1200);

    const meta = await sharp(await optimizeDesignImage(wide)).metadata();

    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(MAX_DESIGN_IMAGE_DIMENSION);
    expect(meta.height).toBe(Math.round((1200 / 3000) * MAX_DESIGN_IMAGE_DIMENSION));
    expect(MAX_DESIGN_IMAGE_DIMENSION).toBeGreaterThan(MAX_IMAGE_DIMENSION);
  });

  test("keeps a uniform white banner background instead of punching it to alpha", async () => {
    const banner = await sharp({
      create: { width: 400, height: 200, channels: 3, background: { r: 250, g: 250, b: 250 } },
    })
      .png()
      .toBuffer();

    const meta = await sharp(await optimizeDesignImage(banner)).metadata();

    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(200);
    expect(meta.hasAlpha).toBeFalsy();
  });
});
