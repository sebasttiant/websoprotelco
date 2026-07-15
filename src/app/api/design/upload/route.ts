import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth/guards";
import { hasPermission } from "@/server/auth/rbac";
import { createDesignImageStorageAdapter, validateUploadFile } from "@/server/storage";

export const runtime = "nodejs";

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

  const formData = await request.formData();
  const value = formData.get("file");
  const file = value instanceof File ? value : null;
  const validation = await validateUploadFile(file);

  if (!validation.valid || !file) {
    return NextResponse.json({ error: validation.error ?? "El archivo de imagen no es válido." }, { status: 400 });
  }

  const storage = await createDesignImageStorageAdapter();
  const storedFile = await storage.saveDesignImage(file, designImageTarget(formData.get("target")));

  return NextResponse.json({ url: storedFile.url }, { status: 201 });
}
