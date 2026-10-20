// @vitest-environment node
import { describe, expect, test } from "vitest";

import OpengraphImage, { alt, contentType, size } from "@/app/opengraph-image";

describe("brand social card", () => {
  test("declares the standard 1200x630 PNG contract", () => {
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe("image/png");
    expect(alt).toContain("SOPROTELCO");
  });

  test("renders an actual PNG image", async () => {
    const response = await OpengraphImage();

    expect(response.headers.get("content-type")).toContain("image/png");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(1000);
    // PNG magic number
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
});
