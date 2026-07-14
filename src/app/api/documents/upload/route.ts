import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth/guards";
import { hasPermission } from "@/server/auth/rbac";
import { createDocumentStorageAdapter, MAX_DOCUMENT_SIZE_BYTES, validateDocumentFile } from "@/server/storage";

// The Server Action body size limit defaults to 1MB, but the spec requires accepting PDFs
// up to 10MB, so this upload MUST go through a route handler instead of a Server Action.
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasPermission(user.role, "documents:write")) {
    return NextResponse.json({ error: "Documents write permission required." }, { status: 403 });
  }

  // Cheap early-out, not the authoritative guard: `content-length` can be spoofed or omitted
  // entirely, so a request that skips or lies about it still falls through to the post-parse
  // `validateDocumentFile` size check below. This only prevents buffering a body we already
  // know exceeds the limit into memory via `request.formData()`.
  const contentLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > MAX_DOCUMENT_SIZE_BYTES) {
    return NextResponse.json({ error: "Document must be 10MB or smaller." }, { status: 413 });
  }

  const formData = await request.formData();
  const value = formData.get("file");
  const file = value instanceof File ? value : null;
  const category = formData.get("category");
  const validation = await validateDocumentFile(file);

  if (!validation.valid || !file) {
    return NextResponse.json({ error: validation.error ?? "Invalid document file." }, { status: 400 });
  }

  const storage = await createDocumentStorageAdapter();
  const storedFile = await storage.saveDocument(file, typeof category === "string" ? category : "other");

  return NextResponse.json(
    { filePath: storedFile.url, fileName: file.name, fileSize: file.size },
    { status: 201 },
  );
}
