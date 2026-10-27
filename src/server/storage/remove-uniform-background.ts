/**
 * Heuristic light-background removal for product photos.
 *
 * Staff usually shoot gear on a near-white desk or lightbox. When the border is a
 * uniform light color, we punch that color to alpha 0 and trim empty margins so the
 * catalog can sit the product on brand ice without a white rectangle. Photos whose
 * border is busy (gradients, patterned backdrops, dark scenes) are left alone —
 * guessing wrong would punch holes in the subject.
 *
 * No ML dependency: pure pixel math on a decoded RGBA buffer so the Docker sharp
 * story stays one native binary.
 */

/** Border samples within this Euclidean RGB distance of the median count as "same color". */
export const BG_MATCH_DISTANCE = 28;

/** Median border luminance (0–255) must be at least this to count as a light studio backdrop. */
export const BG_MIN_LIGHT_LUMA = 210;

/** Fraction of border samples that must match the median color for the backdrop to be "uniform". */
export const BG_UNIFORM_RATIO = 0.92;

/** How many pixels deep from each edge to sample when judging the backdrop. */
const BORDER_DEPTH = 2;

export interface BorderJudgment {
  medianR: number;
  medianG: number;
  medianB: number;
  matchRatio: number;
  luma: number;
  uniformLight: boolean;
}

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function medianOf(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!;
}

/** Collect RGBA samples from a shallow border ring (deterministic, no RNG). */
export function sampleBorderRgba(data: Uint8Array, width: number, height: number, depth = BORDER_DEPTH): number[] {
  const samples: number[] = [];
  const d = Math.max(1, Math.min(depth, Math.floor(Math.min(width, height) / 2)));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const onBorder = x < d || y < d || x >= width - d || y >= height - d;
      if (!onBorder) continue;
      const i = (y * width + x) * 4;
      samples.push(data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!);
    }
  }

  return samples;
}

/**
 * Pure decision: given flattened RGBA border samples, is the backdrop a uniform light studio?
 * Exported so the policy is unit-testable without allocating a full raster.
 */
export function judgeBorderSamples(samples: readonly number[]): BorderJudgment {
  const pixelCount = Math.floor(samples.length / 4);
  if (pixelCount < 8) {
    return { medianR: 0, medianG: 0, medianB: 0, matchRatio: 0, luma: 0, uniformLight: false };
  }

  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let p = 0; p < pixelCount; p += 1) {
    const i = p * 4;
    rs.push(samples[i]!);
    gs.push(samples[i + 1]!);
    bs.push(samples[i + 2]!);
  }
  rs.sort((a, b) => a - b);
  gs.sort((a, b) => a - b);
  bs.sort((a, b) => a - b);

  const medianR = medianOf(rs);
  const medianG = medianOf(gs);
  const medianB = medianOf(bs);
  const light = luma(medianR, medianG, medianB);

  let matches = 0;
  for (let p = 0; p < pixelCount; p += 1) {
    const i = p * 4;
    if (colorDistance(samples[i]!, samples[i + 1]!, samples[i + 2]!, medianR, medianG, medianB) <= BG_MATCH_DISTANCE) {
      matches += 1;
    }
  }

  const matchRatio = matches / pixelCount;
  return {
    medianR,
    medianG,
    medianB,
    matchRatio,
    luma: light,
    uniformLight: light >= BG_MIN_LIGHT_LUMA && matchRatio >= BG_UNIFORM_RATIO,
  };
}

/**
 * Zeroes alpha on pixels close to the judged backdrop color. Mutates `data` in place.
 * Returns whether any pixel was cleared.
 */
export function punchBackgroundToAlpha(
  data: Uint8Array,
  width: number,
  height: number,
  judgment: BorderJudgment,
): boolean {
  let cleared = false;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (
        colorDistance(data[i]!, data[i + 1]!, data[i + 2]!, judgment.medianR, judgment.medianG, judgment.medianB) <=
        BG_MATCH_DISTANCE
      ) {
        data[i + 3] = 0;
        cleared = true;
      }
    }
  }
  return cleared;
}
