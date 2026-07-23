"use client";

import Image from "next/image";
import { useState, type ChangeEvent } from "react";

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

export function DesignImageUploadField({ name, label, target, defaultValue }: DesignImageUploadFieldProps) {
  const [imageUrl, setImageUrl] = useState(defaultValue ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsUploading(true);
    setStatus("Subiendo imagen...");

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
      setStatus("La imagen se subió correctamente.");
    } catch {
      setStatus("No se pudo subir la imagen.");
    } finally {
      setIsUploading(false);
    }
  }

  // Only an adapter-generated design path (/uploads/banners|hero/...) is safe to hand to
  // next/image; any other value would throw at render and crash the design page.
  const canPreview = imageUrl !== "" && isSafeDesignImagePath(imageUrl);

  return (
    <div className="grid gap-3 rounded-3xl border border-slate-200 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-black text-slate-800">{label}</p>
          <p className="text-xs font-semibold text-slate-500">JPG, PNG o WebP. Máximo 5 MB.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">
          {isUploading ? "Subiendo..." : "Subir imagen"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleFileChange} disabled={isUploading} />
        </label>
      </div>
      <input type="hidden" name={name} value={imageUrl} />
      {imageUrl ? (
        <div className="grid gap-2">
          <div className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            {canPreview ? (
              <Image src={imageUrl} alt={`Vista previa de ${label}`} fill sizes="(min-width: 768px) 672px, 100vw" className="object-cover" />
            ) : (
              <p className="px-4 text-center text-xs font-bold text-slate-400">
                Vista previa no disponible. Subí una imagen para reemplazar este valor.
              </p>
            )}
          </div>
          <input
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900"
            aria-label={`URL de ${label}`}
          />
        </div>
      ) : null}
      {status ? <p className="text-xs font-bold text-slate-600">{status}</p> : null}
    </div>
  );
}
