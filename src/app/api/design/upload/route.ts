import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth/guards";
import { hasPermission } from "@/server/auth/rbac";
import { createDesignImageStorageAdapter, MAX_IMAGE_SIZE_BYTES, validateUploadFile } from "@/server/storage";
import { ImageProcessingError } from "@/server/storage/optimize-image";
import { readBoundedFormData, RequestBodyTooLargeError } from "@/server/storage/request-limits";

export const runtime = "nodejs";

const MULTIPART_OVERHEAD_BYTES = 256 * 1024;

function designImageTarget(value: FormDataEntryValue | null): "banners" | "hero" {
  return value === "hero" ? "hero" : "banners";
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Se requiere iniciar sesión." }, { status: 401 });
  }

  if (!hasPermission(user.role, "design:write")) {
    return NextResponse.json({ error: "Necesitás permiso para editar el diseño." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await readBoundedFormData(request, MAX_IMAGE_SIZE_BYTES + MULTIPART_OVERHEAD_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "La imagen debe pesar 5MB o menos." }, { status: 413 });
    }
    throw error;
  }

  const value = formData.get("file");
  const file = value instanceof File ? value : null;
  const validation = await validateUploadFile(file);

  if (!validation.valid || !file) {
    return NextResponse.json({ error: validation.error ?? "El archivo de imagen no es válido." }, { status: 400 });
  }

  try {
    const storage = await createDesignImageStorageAdapter();
    const storedFile = await storage.saveDesignImage(file, designImageTarget(formData.get("target")));
    return NextResponse.json({ url: storedFile.url }, { status: 201 });
  } catch (error) {
    if (error instanceof ImageProcessingError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
