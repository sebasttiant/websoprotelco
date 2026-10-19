import Image from "next/image";

const LOGO = {
  light: {
    src: "/assets/img/sp-logo.png",
    width: 394,
    height: 238,
  },
  dark: {
    src: "/assets/img/sp-logo-white.png",
    width: 394,
    height: 238,
  },
} as const;

export type BrandLogoTone = keyof typeof LOGO;

const SIZE_CLASS = {
  sm: "h-10 w-auto md:h-11",
  md: "h-14 w-auto sm:h-16",
  lg: "h-16 w-auto sm:h-[4.5rem] md:h-20",
  xl: "h-[4.75rem] w-auto sm:h-20 md:h-24",
} as const;

export type BrandLogoSize = keyof typeof SIZE_CLASS;

interface BrandLogoProps {
  alt: string;
  /** `light` = navy mark for pale surfaces; `dark` = white mark for navy/black surfaces. */
  tone?: BrandLogoTone;
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
  size = "lg",
  className = "",
  priority = false,
}: BrandLogoProps) {
  const asset = LOGO[tone];

  return (
    <Image
      src={asset.src}
      alt={alt}
      width={asset.width}
      height={asset.height}
      priority={priority}
      className={`${SIZE_CLASS[size]} max-w-[min(100%,22rem)] object-contain object-left ${className}`.trim()}
    />
  );
}
