// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

import type { SessionUser } from "@/server/auth/session";

const { mockGetCurrentUser, mockSaveDocument } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockSaveDocument: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/server/storage/local", () => ({
  createLocalStorageAdapter: () => ({
    saveDocument: mockSaveDocument,
  }),
}));

import { POST } from "@/app/api/documents/upload/route";

const adminUser: SessionUser = { id: "admin-1", email: "admin@soprotelco.test", role: "admin" };
const staffUser: SessionUser = { id: "staff-1", email: "staff@soprotelco.test", role: "staff" };
const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

function uploadRequest(file: File, extraHeaders?: Record<string, string>): Request {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("category", "manual");

  return new Request("http://localhost:8585/api/documents/upload", {
    method: "POST",
    body: formData,
    headers: extraHeaders,
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/documents/upload", () => {
  test("returns 401 when the request has no authenticated user", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const request = uploadRequest(new File([pdfBytes], "manual.pdf", { type: "application/pdf" }));

    const response = await POST(request);

    await expect(response.json()).resolves.toEqual({ error: "Authentication required." });
    expect(response.status).toBe(401);
    expect(mockSaveDocument).not.toHaveBeenCalled();
  });

  test("returns 403 when the authenticated role cannot write documents", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...staffUser, role: "unknown" as SessionUser["role"] });
    const request = uploadRequest(new File([pdfBytes], "manual.pdf", { type: "application/pdf" }));

    const response = await POST(request);

    await expect(response.json()).resolves.toEqual({ error: "Documents write permission required." });
    expect(response.status).toBe(403);
    expect(mockSaveDocument).not.toHaveBeenCalled();
  });

  test("returns 413 when content-length exceeds the 10MB limit before parsing the body", async () => {
    mockGetCurrentUser.mockResolvedValue(staffUser);
    const request = uploadRequest(new File([pdfBytes], "manual.pdf", { type: "application/pdf" }), {
      "content-length": String(10 * 1024 * 1024 + 1),
    });
    const formDataSpy = vi.spyOn(request, "formData");

    const response = await POST(request);

    await expect(response.json()).resolves.toEqual({ error: "Document must be 10MB or smaller." });
    expect(response.status).toBe(413);
    expect(formDataSpy).not.toHaveBeenCalled();
    expect(mockSaveDocument).not.toHaveBeenCalled();
  });

  test("stores the document for a staff user with documents:write permission", async () => {
    mockGetCurrentUser.mockResolvedValue(staffUser);
    mockSaveDocument.mockResolvedValue({
      url: "/documents/manual/uuid_manual.pdf",
      pathname: "/app/public/documents/manual/uuid_manual.pdf",
    });
    const file = new File([pdfBytes], "manual.pdf", { type: "application/pdf" });

    const response = await POST(uploadRequest(file, { "content-length": String(pdfBytes.length) }));

    await expect(response.json()).resolves.toEqual({
      filePath: "/documents/manual/uuid_manual.pdf",
      fileName: "manual.pdf",
      fileSize: file.size,
    });
    expect(response.status).toBe(201);
    expect(mockSaveDocument).toHaveBeenCalledOnce();
  });

  test("rejects spoofed document content before writing public files", async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser);
    const file = new File(["not-a-real-pdf"], "spoofed.pdf", { type: "application/pdf" });

    const response = await POST(uploadRequest(file));

    await expect(response.json()).resolves.toEqual({ error: "Document content does not match the declared file type." });
    expect(response.status).toBe(400);
    expect(mockSaveDocument).not.toHaveBeenCalled();
  });
});
