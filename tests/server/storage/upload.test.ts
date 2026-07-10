// @vitest-environment node
import { describe, expect, test } from "vitest";

import { MAX_IMAGE_SIZE_BYTES, validateUploadFile } from "@/server/storage";

const IMAGE_BYTES = {
  jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  png: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  webp: new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]),
} as const;

describe("validateUploadFile", () => {
  test("accepts JPG, PNG, and WebP images under the size limit", async () => {
    for (const [type, bytes] of [
      ["image/jpeg", IMAGE_BYTES.jpeg],
      ["image/png", IMAGE_BYTES.png],
      ["image/webp", IMAGE_BYTES.webp],
    ] as const) {
      const file = new File([bytes], "image", { type });

      await expect(validateUploadFile(file)).resolves.toEqual({ valid: true });
    }
  });

  test("rejects unsupported file types", async () => {
    const file = new File(["svg"], "image.svg", { type: "image/svg+xml" });

    await expect(validateUploadFile(file)).resolves.toEqual({ valid: false, error: "Only JPG, PNG, and WebP images are allowed." });
  });

  test("rejects images larger than 5MB", async () => {
    const file = new File([new Uint8Array(MAX_IMAGE_SIZE_BYTES + 1)], "large.png", { type: "image/png" });

    await expect(validateUploadFile(file)).resolves.toEqual({ valid: false, error: "Image must be 5MB or smaller." });
  });

  test("rejects spoofed image content when the MIME type is allowed", async () => {
    const file = new File(["not-a-real-png"], "spoofed.png", { type: "image/png" });

    await expect(validateUploadFile(file)).resolves.toEqual({
      valid: false,
      error: "Image content does not match the declared file type.",
    });
  });
});
