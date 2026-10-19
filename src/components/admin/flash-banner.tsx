"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";

const SUCCESS_MESSAGES: Record<string, string> = {
  "product-created": "Producto creado correctamente.",
  "product-updated": "Producto actualizado.",
  "product-deleted": "Producto eliminado.",
  "products-imported": "Importación de productos completada.",
  "category-created": "Categoría creada.",
  "category-updated": "Categoría actualizada.",
  "category-deleted": "Categoría eliminada.",
  "movement-recorded": "Stock actualizado.",
  "order-created": "Pedido registrado.",
  "settings-updated": "Configuración guardada.",
  "setting-updated": "Configuración guardada.",
};

const ERROR_MESSAGES: Record<string, string> = {
  "action-failed": "No se pudo completar la operación. Revisá los datos e intentá de nuevo.",
  "import-failed": "La importación falló. Revisá el archivo CSV.",
};

/**
 * Reads ?success= / ?error= from the URL, shows a friendly banner, then cleans the query
 * so a refresh does not replay the same toast forever.
 */
export function AdminFlashBanner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null);

  const flash = useMemo(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    if (success) {
      return {
        tone: "success" as const,
        message: SUCCESS_MESSAGES[success] ?? "Listo. Los cambios se guardaron.",
      };
    }
    if (error) {
      return {
        tone: "error" as const,
        message: ERROR_MESSAGES[error] ?? "Hubo un problema al guardar.",
      };
    }
    return null;
  }, [searchParams]);

  const dismissed = flash != null && dismissedMessage === flash.message;

  useEffect(() => {
    if (!flash) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("success");
    params.delete("error");
    const next = params.toString();
    const timer = window.setTimeout(() => {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }, 4_000);
    return () => window.clearTimeout(timer);
  }, [flash, pathname, router, searchParams]);

  if (!flash || dismissed) return null;

  const isSuccess = flash.tone === "success";

  return (
    <div
      role="status"
      className={`mb-4 flex items-start gap-3 rounded-xl border px-3.5 py-2.5 shadow-sm ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-rose-200 bg-rose-50 text-rose-900"
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      ) : (
        <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
      )}
      <p className="min-w-0 flex-1 text-sm font-bold">{flash.message}</p>
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={() => setDismissedMessage(flash.message)}
        className="rounded-lg p-1 opacity-70 transition hover:opacity-100"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
