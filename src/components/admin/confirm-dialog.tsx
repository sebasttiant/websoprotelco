"use client";

import type { ReactNode } from "react";

interface ConfirmDialogProps {
  message: string;
  children: ReactNode;
}

export function ConfirmDialog({ message, children }: ConfirmDialogProps) {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
      className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-50"
    >
      {children}
    </button>
  );
}
