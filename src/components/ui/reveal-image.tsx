"use client";

import Image from "next/image";
import { useState } from "react";

interface RevealImageProps {
  src: string;
  alt: string;
  /** Above-the-fold product photos stay eager; catalog grids stay lazy. */
  priority?: boolean;
  className?: string;
  sizes?: string;
}

/**
 * Soft mount for catalog photos: the box is reserved first, a quiet skeleton holds
 * the space, and the WebP/AVIF fades in when the bytes land. Upload already bounds
 * and re-encodes; next/image adds responsive srcset + modern formats on the wire.
 *
 * Always `object-contain` inside an overflow-hidden parent so uploads never stretch
 * or spill out of the card / PDP frame.
 *
 * `src` must already be a safe catalog path from `getSafeCatalogImageUrl` — this
 * component does not re-validate; handing it a remote URL would open the image
 * optimizer to an open-proxy risk.
 */
export function RevealImage(props: RevealImageProps) {
  // Remount when `src` changes so ready/failed state resets without an effect.
  return <RevealImageInner key={props.src} {...props} />;
}

function RevealImageInner({
  src,
  alt,
  priority = false,
  className = "",
  sizes = "(min-width: 1280px) 20vw, (min-width: 640px) 40vw, 90vw",
}: RevealImageProps) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="relative grid h-full w-full place-items-center bg-brand-ice px-4 text-center text-xs font-bold text-brand-muted">
        No se pudo cargar la imagen
      </span>
    );
  }

  return (
    <span className="relative block h-full min-h-0 w-full min-w-0 overflow-hidden">
      <span
        aria-hidden="true"
        className={`absolute inset-0 rounded-[inherit] bg-gradient-to-br from-brand-line/80 via-white to-brand-ice transition-opacity duration-500 ${
          ready ? "opacity-0" : "opacity-100 motion-safe:animate-pulse"
        }`}
      />
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        onLoad={() => setReady(true)}
        onError={() => setFailed(true)}
        className={`object-contain transition duration-700 ease-out motion-reduce:transition-none ${
          ready ? "scale-100 opacity-100" : "scale-[1.02] opacity-0"
        } ${className}`}
      />
    </span>
  );
}
