import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth/guards";
import { hasPermission } from "@/server/auth/rbac";
import { createStorageAdapter, validateUploadFile } from "@/server/storage";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Se requiere iniciar sesión." }, { status: 401 });
  }

  if (!hasPermission(user.role, "catalog:write")) {
    return NextResponse.json({ error: "Necesitás permiso para editar el catálogo." }, { status: 403 });
  }

  const formData = await request.formData();
  const value = formData.get("file");
  const file = value instanceof File ? value : null;
  const validation = await validateUploadFile(file);

  if (!validation.valid || !file) {
    return NextResponse.json({ error: validation.error ?? "El archivo de imagen no es válido." }, { status: 400 });
  }

  const storage = await createStorageAdapter();
  const storedFile = await storage.save(file);

  return NextResponse.json({ url: storedFile.url }, { status: 201 });
}
