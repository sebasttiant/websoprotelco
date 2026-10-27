// @vitest-environment node
import { describe, expect, test } from "vitest";

import nextConfig from "../../next.config";

describe("next.config images", () => {
  test("negotiates AVIF/WebP and only optimizes controlled local roots", () => {
    expect(nextConfig.images?.formats).toEqual(["image/avif", "image/webp"]);
    expect(nextConfig.images?.localPatterns).toEqual([
      { pathname: "/uploads/**", search: "" },
      { pathname: "/assets/**", search: "" },
    ]);
  });
});
