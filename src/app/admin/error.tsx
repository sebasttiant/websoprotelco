"use client";

import { useEffect } from "react";

interface AdminErrorProps {
  // `digest` is Next.js's server-generated hash of the error — safe to show as a support
  // reference because it contains no secrets, unlike `error.message`.
  error: Error & { digest?: string };
  reset: () => void;
}

// Admin-wide error boundary. It shows a calm Spanish message and a retry action. It deliberately
// does NOT render `error.message`: that can carry SQL, stack traces, or internal paths. The raw
// error still reaches the server/browser console for diagnostics.
export default function AdminError({ error, reset }: AdminErrorProps) {
  useEffect(() => {
    console.error("Admin route error", error);
  }, [error]);

  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-[28px] bg-white p-10 text-center shadow-xl shadow-blue-950/5">
      <p className="text-xs font-black uppercase tracking-widest text-red-600">Algo salió mal</p>
      <h1 className="text-2xl font-black text-slate-950">No pudimos cargar esta sección</h1>
      <p className="text-sm font-medium text-slate-500">
        Ocurrió un error inesperado. Podés reintentar; si el problema continúa, contactá al soporte.
      </p>
      {error.digest ? (
        <p className="text-xs font-medium text-slate-400">Código de referencia: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-brand-blue px-5 py-3 text-sm font-black text-white"
      >
        Reintentar
      </button>
    </section>
  );
}
