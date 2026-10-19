"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";

// Imported from the pure schema module, not the domain barrel: this is a client component and
// the barrel re-exports server actions ("use server") and the pg-backed repository.
import { isSafeCatalogImagePath } from "@/domains/catalog/schemas";

interface ImageUploadFieldProps {
  name: string;
  label: string;
  defaultValue?: string | null;
}

interface UploadResponse {
  url?: string;
  error?: string;
}

const MAX_CLIENT_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

export function ImageUploadField({ name, label, defaultValue }: ImageUploadFieldProps) {
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

    try {
      const response = await fetch("/api/upload", { method: "POST", body: data });
      const payload = (await response.json()) as UploadResponse;

      if (!response.ok || !payload.url) {
        setStatus(payload.error ?? "No se pudo subir la imagen.");
        return;
      }

      setImageUrl(payload.url);
      setStatus("Imagen lista: se optimizó a WebP para que cargue bien en la tienda.");
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

  // Only a trusted, adapter-generated local path is handed to next/image. Any other value —
  // a remote URL, a base64 data URI, a legacy or manually typed string — would throw at render
  // and crash the edit page, so it falls back to a stable placeholder instead.
  const canPreview = imageUrl !== "" && isSafeCatalogImagePath(imageUrl);

  return (
    <div className="grid min-w-0 gap-3 rounded-2xl border border-slate-200 p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-800">{label}</p>
          <p className="text-xs font-semibold text-slate-500">
            JPG, PNG o WebP · máx. 5 MB · se convierte a WebP (máx. 1600px) al subir.
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
          <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            {canPreview ? (
              <Image
                src={imageUrl}
                alt={`Vista previa de ${label}`}
                fill
                sizes="(min-width: 640px) 24rem, 100vw"
                className="object-contain p-3"
              />
            ) : (
              <p className="grid h-full place-items-center px-4 text-center text-xs font-bold text-slate-400">
                Vista previa no disponible. Subí una imagen nueva para reemplazar este valor.
              </p>
            )}
          </div>
          <p className="truncate text-center text-[0.65rem] font-medium text-slate-400" title={imageUrl}>
            {imageUrl}
          </p>
        </div>
      ) : null}
      {status ? <p className="text-xs font-bold text-slate-600">{status}</p> : null}
    </div>
  );
}
