"use client";

import { useRef, useState } from "react";

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
 * the space, and the WebP fades in when the bytes land. Images are already optimized
 * at upload, so this is presentation only — no runtime resize on the VPS.
 *
 * Always `object-contain` inside an overflow-hidden parent so uploads never stretch
 * or spill out of the card / PDP frame.
 */
export function RevealImage(props: RevealImageProps) {
  // Remount when `src` changes so ready/failed state resets without an effect.
  return <RevealImageInner key={props.src} {...props} />;
}

function RevealImageInner({ src, alt, priority = false, className = "", sizes }: RevealImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  function bindImage(image: HTMLImageElement | null) {
    imageRef.current = image;
    // Cached images may already be complete before onLoad fires.
    if (image?.complete && image.naturalWidth > 0) {
      queueMicrotask(() => setReady(true));
    }
  }

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
      {/* eslint-disable-next-line @next/next/no-img-element -- catalog WebP is pre-sized at upload */}
      <img
        ref={bindImage}
        src={src}
        alt={alt}
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onLoad={() => setReady(true)}
        onError={() => setFailed(true)}
        className={`h-full max-h-full w-full max-w-full object-contain transition duration-700 ease-out motion-reduce:transition-none ${
          ready ? "scale-100 opacity-100" : "scale-[1.02] opacity-0"
        } ${className}`}
      />
    </span>
  );
}
