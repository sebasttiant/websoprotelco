// @vitest-environment node
import { describe, expect, test } from "vitest";

import {
  BG_MIN_LIGHT_LUMA,
  BG_UNIFORM_RATIO,
  judgeBorderSamples,
  punchBackgroundToAlpha,
} from "@/server/storage/remove-uniform-background";

function rgbaBorder(width: number, height: number, fill: [number, number, number, number]): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4;
    data[o] = fill[0];
    data[o + 1] = fill[1];
    data[o + 2] = fill[2];
    data[o + 3] = fill[3];
  }
  return data;
}

describe("judgeBorderSamples", () => {
  test("accepts a uniform near-white border as a light studio backdrop", () => {
    const samples: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      samples.push(248, 248, 250, 255);
    }

    const judgment = judgeBorderSamples(samples);

    expect(judgment.uniformLight).toBe(true);
    expect(judgment.luma).toBeGreaterThanOrEqual(BG_MIN_LIGHT_LUMA);
    expect(judgment.matchRatio).toBeGreaterThanOrEqual(BG_UNIFORM_RATIO);
  });

  test("rejects a dark uniform border instead of inventing a transparent hole", () => {
    const samples: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      samples.push(20, 24, 30, 255);
    }

    expect(judgeBorderSamples(samples).uniformLight).toBe(false);
  });

  test("rejects a busy light border whose colors disagree", () => {
    const samples: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      samples.push(250, 250, 250, 255);
      samples.push(120, 180, 240, 255);
    }

    const judgment = judgeBorderSamples(samples);

    expect(judgment.uniformLight).toBe(false);
    expect(judgment.matchRatio).toBeLessThan(BG_UNIFORM_RATIO);
  });
});

describe("punchBackgroundToAlpha", () => {
  test("clears only pixels near the judged backdrop color", () => {
    const data = rgbaBorder(4, 4, [250, 250, 250, 255]);
    // Center subject pixel stays opaque navy.
    data[(1 * 4 + 1) * 4] = 10;
    data[(1 * 4 + 1) * 4 + 1] = 40;
    data[(1 * 4 + 1) * 4 + 2] = 120;
    data[(1 * 4 + 1) * 4 + 3] = 255;

    const samples: number[] = [];
    for (let i = 0; i < 16; i += 1) samples.push(250, 250, 250, 255);
    const judgment = judgeBorderSamples(samples);
    expect(judgment.uniformLight).toBe(true);

    expect(punchBackgroundToAlpha(data, 4, 4, judgment)).toBe(true);
    expect(data[(1 * 4 + 1) * 4 + 3]).toBe(255);
    expect(data[3]).toBe(0);
  });
});
