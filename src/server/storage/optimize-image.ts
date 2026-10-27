import sharp from "sharp";

import {
  judgeBorderSamples,
  punchBackgroundToAlpha,
  sampleBorderRgba,
} from "./remove-uniform-background";

// Largest edge a stored product image is allowed to keep. A phone photo is often 4000px+ on
// its long side; nothing in the catalog UI renders larger than this, so anything beyond it is
// bytes paid for and never seen. `withoutEnlargement` means an already-small image is left at
// its own size rather than upscaled into blur.
export const MAX_IMAGE_DIMENSION = 1600;

// Banners/hero need a wider canvas than product thumbs, but still must not ship 4K originals.
export const MAX_DESIGN_IMAGE_DIMENSION = 1920;

// Decoded pixel area ceiling BEFORE transform. A tiny truncated file can claim a huge canvas;
// decoding it would exhaust memory even though the upload byte cap already passed.
export const MAX_SOURCE_PIXELS = 40_000_000;

// WebP quality. 80 is the well-worn sweet spot: visually indistinguishable from the source for
// product photography, at a fraction of the size of the original JPEG/PNG.
const WEBP_QUALITY = 80;

// The stored format for every optimized image. One format keeps the storage layer simple and
// WebP is universally supported by the browsers this catalog targets.
export const OPTIMIZED_IMAGE_EXTENSION = "webp";
export const OPTIMIZED_IMAGE_CONTENT_TYPE = "image/webp";

/**
 * Handled failure from the image pipeline. Routes map this to HTTP 400 so a truncated or
 * absurdly large source never becomes an uncaught 500 from sharp.
 */
export class ImageProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageProcessingError";
  }
}

/** Pure bound check so pixel-area policy can be tested without allocating a huge raster. */
export function isWithinSourcePixelBudget(width: number, height: number): boolean {
  return width > 0 && height > 0 && width * height <= MAX_SOURCE_PIXELS;
}

interface OptimizeOptions {
  maxDimension: number;
  /** Product uploads may punch a uniform light studio backdrop to alpha; banners never do. */
  removeUniformBackground: boolean;
}

/**
 * Turns a validated upload into a web-ready image: oriented, bounded, optionally with a
 * uniform light background removed, re-encoded as WebP, stripped of metadata. Aspect ratio
 * is preserved (`fit: "inside"`) so nothing is stretched or cropped at upload time — the UI
 * decides cover vs contain.
 *
 * This runs AFTER validateUploadFile, so the input is already a real jpg/png/webp within the
 * size cap — this step is about weight on disk and on the wire, not magic-byte safety. Codec
 * and pixel-area failures are still handled here because a valid prefix does not guarantee a
 * decodable payload.
 *
 * `.rotate()` with no argument applies the EXIF orientation and then the re-encode drops all
 * metadata, so a photo taken sideways is stored upright AND location/camera EXIF does not ship.
 */
async function optimizeImageBuffer(input: Buffer, options: OptimizeOptions): Promise<Buffer> {
  try {
    const meta = await sharp(input, { failOn: "error" }).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    if (!isWithinSourcePixelBudget(width, height)) {
      throw new ImageProcessingError(
        width <= 0 || height <= 0
          ? "No pudimos leer las dimensiones de la imagen."
          : "La imagen es demasiado grande en resolución. Usá una más chica.",
      );
    }

    const pipeline = sharp(input)
      .rotate()
      .resize(options.maxDimension, options.maxDimension, {
        fit: "inside",
        withoutEnlargement: true,
      });

    if (options.removeUniformBackground) {
      // Work in RGBA so the backdrop punch has an alpha channel to write into.
      const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const rgba = new Uint8Array(data);
      const judgment = judgeBorderSamples(sampleBorderRgba(rgba, info.width, info.height));

      if (judgment.uniformLight && punchBackgroundToAlpha(rgba, info.width, info.height, judgment)) {
        return await sharp(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength), {
          raw: { width: info.width, height: info.height, channels: 4 },
        })
          .trim({ threshold: 10 })
          .webp({ quality: WEBP_QUALITY, alphaQuality: WEBP_QUALITY })
          .toBuffer();
      }

      // Busy or dark border: re-encode the already-resized RGBA without punching.
      return await sharp(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength), {
        raw: { width: info.width, height: info.height, channels: 4 },
      })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
    }

    return await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
  } catch (error) {
    if (error instanceof ImageProcessingError) throw error;
    throw new ImageProcessingError("La imagen no se pudo procesar. Subí un JPG, PNG o WebP válido.");
  }
}

/** Product / category catalog uploads — may remove a uniform light studio backdrop. */
export async function optimizeProductImage(input: Buffer): Promise<Buffer> {
  return optimizeImageBuffer(input, {
    maxDimension: MAX_IMAGE_DIMENSION,
    removeUniformBackground: true,
  });
}

/** Banner / hero uploads — slightly larger long edge; background is intentional art, keep it. */
export async function optimizeDesignImage(input: Buffer): Promise<Buffer> {
  return optimizeImageBuffer(input, {
    maxDimension: MAX_DESIGN_IMAGE_DIMENSION,
    removeUniformBackground: false,
  });
}

/** Shared entry used by tests that want an explicit max without background removal. */
export async function optimizeImage(input: Buffer, maxDimension: number = MAX_IMAGE_DIMENSION): Promise<Buffer> {
  return optimizeImageBuffer(input, { maxDimension, removeUniformBackground: false });
}
