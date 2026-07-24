"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Never fires: whether the document exists is not a value that changes at runtime, so there is
// nothing to subscribe to. useSyncExternalStore is used purely for its server/client split.
function subscribe(): () => void {
  return () => {};
}

/**
 * Renders children into `document.body`, outside whatever layout the caller sits in.
 *
 * Overlays MUST use this. `position: fixed` resolves against the viewport only while no
 * ancestor establishes a containing block — and `transform`, `filter`, `backdrop-filter`,
 * `perspective`, `contain` and `will-change` all do. The site header carries
 * `backdrop-blur-xl`, so a fixed overlay rendered inside it was sized and positioned against
 * the header instead of the window: a full-height drawer collapsed into a clipped box in the
 * top-right corner, with its backdrop still swallowing clicks across the page.
 *
 * Nothing about the overlay's own CSS can prevent that. Escaping the subtree is the fix.
 *
 * `document` does not exist while rendering on the server, and portalling during hydration
 * would mismatch the server-rendered markup, so this yields false on the server and true once
 * hydrated. useSyncExternalStore rather than a mount effect: setting state from an effect body
 * causes the cascading re-render the react-hooks/set-state-in-effect rule exists to prevent.
 */
export function Portal({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  if (!hydrated) {
    return null;
  }

  return createPortal(children, document.body);
}
