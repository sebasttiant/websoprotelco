import { useEffect, useRef } from "react";

/**
 * Modal behavior for the slide-over: focus moves to the returned close-button ref on open,
 * Escape closes it, and the page behind it stops scrolling. A slide-over that traps neither
 * key nor focus is unusable with a keyboard and invisible to a screen reader.
 */
export function useDrawerBehavior(open: boolean, onClose: () => void) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // The page behind a modal must not scroll away under it.
  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return closeButtonRef;
}
