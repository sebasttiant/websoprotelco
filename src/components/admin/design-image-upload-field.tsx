"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent } from "react";

// Imported from the pure schema module, not the domain barrel: this is a client component.
import { isSafeDesignImagePath } from "@/domains/design/schemas";

interface DesignImageUploadFieldProps {
  name: string;
  label: string;
  target: "banners" | "hero";
  defaultValue?: string | null;
}

interface UploadResponse {
  url?: string;
  error?: string;
}

const MAX_CLIENT_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

export function DesignImageUploadField({ name, label, target, defaultValue }: DesignImageUploadFieldProps) {
  const [imageUrl, setImageUrl] = useState(defaultValue ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!ACCEPT.split(",").includes(file.type)) {
      setStatus("Solo se admiten imágenes JPG, PNG y WebP.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_CLIENT_BYTES) {
      setStatus("La imagen debe pesar 5 MB o menos.");
      event.target.value = "";
      return;
    }

    setIsUploading(true);
    setStatus("Subiendo y optimizando imagen…");

    const data = new FormData();
    data.set("file", file);
    data.set("target", target);

    try {
      const response = await fetch("/api/design/upload", { method: "POST", body: data });
      const payload = (await response.json()) as UploadResponse;

      if (!response.ok || !payload.url) {
        setStatus(payload.error ?? "No se pudo subir la imagen.");
        return;
      }

      setImageUrl(payload.url);
      setStatus("Imagen lista: optimizada a WebP para el sitio.");
    } catch {
      setStatus("No se pudo subir la imagen.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  function clearImage() {
    setImageUrl("");
    setStatus("Imagen quitada. Guardá el formulario para confirmar.");
    if (inputRef.current) inputRef.current.value = "";
  }

  // Only an adapter-generated design path (/uploads/banners|hero/...) is safe to hand to
  // next/image; any other value would throw at render and crash the design page.
  const canPreview = imageUrl !== "" && isSafeDesignImagePath(imageUrl);

  return (
    <div className="grid min-w-0 gap-3 rounded-2xl border border-slate-200 p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-800">{label}</p>
          <p className="text-xs font-semibold text-slate-500">
            JPG, PNG o WebP · máx. 5 MB · se convierte a WebP (máx. 1920px) al subir.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-slate-800">
            {isUploading ? "Subiendo…" : "Subir imagen"}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </label>
          {imageUrl ? (
            <button
              type="button"
              onClick={clearImage}
              disabled={isUploading}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 transition hover:border-rose-300 hover:text-rose-600"
            >
              Quitar
            </button>
          ) : null}
        </div>
      </div>
      <input type="hidden" name={name} value={imageUrl} />
      {imageUrl ? (
        <div className="grid min-w-0 gap-2">
          <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 sm:h-48">
            {canPreview ? (
              <Image
                src={imageUrl}
                alt={`Vista previa de ${label}`}
                fill
                sizes="(min-width: 768px) 672px, 100vw"
                className="object-contain p-2"
              />
            ) : (
              <p className="grid h-full place-items-center px-4 text-center text-xs font-bold text-slate-400">
                Vista previa no disponible. Subí una imagen para reemplazar este valor.
              </p>
            )}
          </div>
          <p className="truncate text-[0.65rem] font-medium text-slate-400" title={imageUrl}>
            {imageUrl}
          </p>
        </div>
      ) : null}
      {status ? <p className="text-xs font-bold text-slate-600">{status}</p> : null}
    </div>
  );
}
