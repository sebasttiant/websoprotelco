import Image from "next/image";

const LOGO = {
  full: {
    light: {
      src: "/assets/brand/soprotelco-logo.svg",
      width: 394,
      height: 238,
    },
    dark: {
      src: "/assets/brand/soprotelco-logo-white.svg",
      width: 394,
      height: 238,
    },
  },
  symbol: {
    light: {
      src: "/assets/brand/soprotelco-symbol.svg",
      width: 344,
      height: 122,
    },
    dark: {
      src: "/assets/brand/soprotelco-symbol-white.svg",
      width: 344,
      height: 122,
    },
  },
} as const;

export type BrandLogoVariant = keyof typeof LOGO;
export type BrandLogoTone = keyof (typeof LOGO)["full"];

const SIZE_CLASS = {
  sm: "h-10 w-auto md:h-11",
  md: "h-14 w-auto sm:h-16",
  lg: "h-16 w-auto sm:h-[4.5rem] md:h-20",
  xl: "h-[4.75rem] w-auto sm:h-20 md:h-24",
} as const;

// The symbol is much wider than tall (344×122), so the same heights would make
// bars and sidebars enormous. Symbol sizes keep the mark readable but slim.
const SYMBOL_SIZE_CLASS = {
  sm: "h-8 w-auto",
  md: "h-9 w-auto sm:h-10",
  lg: "h-11 w-auto sm:h-12",
  xl: "h-12 w-auto sm:h-14",
} as const;

export type BrandLogoSize = keyof typeof SIZE_CLASS;

interface BrandLogoProps {
  alt: string;
  /** `light` = navy mark for pale surfaces; `dark` = white mark for navy/black surfaces. */
  tone?: BrandLogoTone;
  /** `full` includes the legend; `symbol` is the SP + box mark for tight spaces. */
  variant?: BrandLogoVariant;
  size?: BrandLogoSize;
  className?: string;
  priority?: boolean;
}

/**
 * Single incorporation point for the SOPROTELCO mark so header, footer, auth and
 * admin cannot drift to different assets or aspect ratios.
 */
export function BrandLogo({
  alt,
  tone = "light",
  variant = "full",
  size = "lg",
  className = "",
  priority = false,
}: BrandLogoProps) {
  const asset = LOGO[variant][tone];
  const sizeClass = variant === "symbol" ? SYMBOL_SIZE_CLASS[size] : SIZE_CLASS[size];

  return (
    <Image
      src={asset.src}
      alt={alt}
      width={asset.width}
      height={asset.height}
      priority={priority}
      className={`${sizeClass} max-w-[min(100%,22rem)] object-contain object-left ${className}`.trim()}
    />
  );
}
