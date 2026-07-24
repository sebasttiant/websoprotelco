// A tinted square showing one or two initials, used to give catalog rows a stable visual
// anchor. The colour is DERIVED from a seed string, not random, so the same product or category
// always looks the same across renders and pages — a random colour per mount would make the
// list shimmer on every navigation and defeat the recognition it exists to provide.

// Soft tints on a light panel: enough separation to tell rows apart, never loud enough to
// compete with the status badges. Background and text are paired so contrast holds in each.
const AVATAR_PALETTE: readonly string[] = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
];

// Up to two initials: the first letter of each of the first two words, or the first two letters
// of a single word. Non-letters are ignored so "10/100M" does not yield "10".
export function initialsFrom(value: string): string {
  const words = value
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return "?";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (words[0][0] + words[1][0]).toUpperCase();
}

// Stable, well-distributed index into the palette. A plain char-sum collides badly on short
// similar strings (SKUs share prefixes), so this is the classic 31-multiplier string hash.
export function paletteIndexFor(seed: string, paletteLength: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % paletteLength;
}

interface InitialAvatarProps {
  /** The text the initials are taken from — a product, category or person name. */
  name: string;
  /** What the colour is keyed to. Defaults to `name`; pass an SKU or id for finer separation. */
  seed?: string;
  /** Rounded square for catalog rows (default), full circle for people. */
  shape?: "square" | "circle";
  className?: string;
}

export function InitialAvatar({ name, seed, shape = "square", className = "" }: InitialAvatarProps) {
  const tone = AVATAR_PALETTE[paletteIndexFor(seed ?? name, AVATAR_PALETTE.length)];
  const radius = shape === "circle" ? "rounded-full" : "rounded-xl";

  // Decorative: the row already names the item in text beside this, so the initials would only
  // repeat it for a screen reader.
  return (
    <span
      aria-hidden="true"
      className={`grid h-10 w-10 shrink-0 place-items-center ${radius} text-xs font-black ${tone} ${className}`}
    >
      {initialsFrom(name)}
    </span>
  );
}
