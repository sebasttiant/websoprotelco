"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

interface ConfirmDialogProps {
  // The full Spanish sentence, e.g. '¿Eliminar el producto "Cable X"? Esta acción no se puede
  // deshacer.' Include the entity name and the consequence.
  message: string;
  // Trigger label (what the user clicks in the row).
  children: ReactNode;
  title?: string;
  confirmLabel?: string;
  triggerClassName?: string;
}

// Reused accessible confirmation for destructive actions. The confirm control is a real submit
// button inside the enclosing <form>, so it drives the server action; `useFormStatus` shows
// progress and blocks a double submit. Cancel is the safe default (autofocused, closes on
// Escape or overlay click). Replaces the old native window.confirm (English OS buttons).
export function ConfirmDialog({
  message,
  children,
  title = "Confirmar eliminación",
  confirmLabel = "Eliminar",
  triggerClassName,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    cancelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "rounded-full border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-50"
        }
      >
        {children}
      </button>

      {open ? (
        <div
          role="presentation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={messageId}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl shadow-blue-950/20"
          >
            <h2 id={titleId} className="text-lg font-black text-slate-950">
              {title}
            </h2>
            <p id={messageId} className="mt-2 text-sm font-medium text-slate-600">
              {message}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <ConfirmButton label={confirmLabel} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// Separate child so it can read the enclosing form's pending state: while the server action runs
// it shows progress and disables, preventing a second submission.
function ConfirmButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Eliminando..." : label}
    </button>
  );
}
