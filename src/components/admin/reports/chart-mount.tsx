"use client";

import { useSyncExternalStore, type ReactNode } from "react";

/**
 * Recharts measures the DOM on the client; SSR markup never matches.
 * Render a stable placeholder until mount so hydration stays clean.
 */
function subscribe() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function ChartMount({
  children,
  className = "flex h-56 items-center justify-center",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ready = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  if (!ready) {
    return <div className={className} aria-hidden="true" />;
  }

  return children;
}
