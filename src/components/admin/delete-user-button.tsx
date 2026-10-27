"use client";

import { Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { deleteUser, type ManageUserActionState } from "@/domains/users/actions";
import { Portal } from "@/components/ui/portal";

interface DeleteUserButtonProps {
  userId: string;
  email: string;
  /** When true, the control is hidden — an admin must not delete their own row. */
  disabled?: boolean;
}

export function DeleteUserButton({ userId, email, disabled = false }: DeleteUserButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (disabled) return null;

  async function confirmDelete(): Promise<void> {
    setPending(true);
    setError("");

    const state: ManageUserActionState = await deleteUser({ id: userId });

    setPending(false);

    if (!state.success) {
      setError(state.message);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        aria-label={`Eliminar ${email}`}
        className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-widest text-red-700 transition hover:border-red-400 hover:bg-red-50"
      >
        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
        Eliminar
      </button>

      {open ? (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div aria-hidden="true" onClick={() => setOpen(false)} className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm" />

            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Eliminar usuario ${email}`}
              className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <header className="flex items-start justify-between border-b border-brand-line px-7 py-5">
                <div>
                  <h2 className="text-2xl font-black text-brand-navy">Eliminar usuario</h2>
                  <p className="mt-1 text-sm font-medium text-brand-muted">
                    Vas a borrar <span className="font-black text-brand-navy">{email}</span>. Esta acción no se puede deshacer.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="rounded-full p-2 text-brand-muted transition hover:bg-brand-ice hover:text-brand-navy"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </header>

              <div className="space-y-4 px-7 py-6">
                {error ? (
                  <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                    {error}
                  </p>
                ) : null}
                <p className="text-sm font-medium text-brand-muted">
                  Si solo querés bloquear el acceso, editá el usuario y desmarcá &quot;Cuenta activa&quot;.
                </p>
              </div>

              <footer className="flex flex-col gap-3 border-t border-brand-line px-7 py-5 sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={pending}
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-red-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending ? "Eliminando…" : "Sí, eliminar"}
                </button>
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="inline-flex flex-1 items-center justify-center rounded-full border border-brand-line px-6 py-3 text-xs font-black uppercase tracking-widest text-brand-navy transition hover:bg-brand-ice disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>
              </footer>
            </div>
          </div>
        </Portal>
      ) : null}
    </>
  );
}
