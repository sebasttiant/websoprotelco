import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth/guards";
import { hasPermission } from "@/server/auth/rbac";
import { createStorageAdapter, validateUploadFile } from "@/server/storage";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasPermission(user.role, "catalog:write")) {
    return NextResponse.json({ error: "Catalog write permission required." }, { status: 403 });
  }

  const formData = await request.formData();
  const value = formData.get("file");
  const file = value instanceof File ? value : null;
  const validation = await validateUploadFile(file);

  if (!validation.valid || !file) {
    return NextResponse.json({ error: validation.error ?? "Invalid image file." }, { status: 400 });
  }

  const storage = await createStorageAdapter();
  const storedFile = await storage.save(file);

  return NextResponse.json({ url: storedFile.url }, { status: 201 });
}
