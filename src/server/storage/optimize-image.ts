import sharp from "sharp";

// Largest edge a stored product image is allowed to keep. A phone photo is often 4000px+ on
// its long side; nothing in the catalog UI renders larger than this, so anything beyond it is
// bytes paid for and never seen. `withoutEnlargement` means a already-small image is left at
// its own size rather than upscaled into blur.
export const MAX_IMAGE_DIMENSION = 1600;

// WebP quality. 80 is the well-worn sweet spot: visually indistinguishable from the source for
// product photography, at a fraction of the size of the original JPEG/PNG.
const WEBP_QUALITY = 80;

// The stored format for every optimized image. One format keeps the storage layer simple and
// WebP is universally supported by the browsers this catalog targets.
export const OPTIMIZED_IMAGE_EXTENSION = "webp";
export const OPTIMIZED_IMAGE_CONTENT_TYPE = "image/webp";

/**
 * Turns a validated upload into a web-ready image: oriented, bounded to MAX_IMAGE_DIMENSION,
 * re-encoded as WebP, stripped of metadata.
 *
 * This runs AFTER validateUploadFile, so the input is already a real jpg/png/webp within the
 * size cap — this step is about weight on disk and on the wire, not safety. A 5 MB camera photo
 * comes out around 150-300 KB, which is what keeps a 1500-product catalog from turning every
 * grid into tens of megabytes of download and the volume into gigabytes of originals.
 *
 * `.rotate()` with no argument applies the EXIF orientation and then the re-encode drops all
 * metadata, so a photo taken sideways is stored upright AND the location/camera EXIF a customer
 * never meant to publish does not ship with it.
 */
export async function optimizeProductImage(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}
