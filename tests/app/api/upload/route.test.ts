// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

import type { SessionUser } from "@/server/auth/session";

const { mockGetCurrentUser, mockSave } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockSave: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/server/storage/local", () => ({
  createLocalStorageAdapter: () => ({
    save: mockSave,
  }),
}));

import { POST } from "@/app/api/upload/route";

const adminUser: SessionUser = { id: "admin-1", email: "admin@soprotelco.test", role: "admin" };
const staffUser: SessionUser = { id: "staff-1", email: "staff@soprotelco.test", role: "staff" };
const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function uploadRequest(file: File): Request {
  const formData = new FormData();
  formData.set("file", file);

  return new Request("http://localhost:8585/api/upload", {
    method: "POST",
    body: formData,
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/upload", () => {
  test("returns 401 when the request has no authenticated user", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const request = uploadRequest(new File([pngBytes], "product.png", { type: "image/png" }));

    const response = await POST(request);

    await expect(response.json()).resolves.toEqual({ error: "Se requiere iniciar sesión." });
    expect(response.status).toBe(401);
    expect(mockSave).not.toHaveBeenCalled();
  });

  test("returns 403 when the authenticated role cannot write the catalog", async () => {
    mockGetCurrentUser.mockResolvedValue(staffUser);
    const request = uploadRequest(new File([pngBytes], "product.png", { type: "image/png" }));

    const response = await POST(request);

    await expect(response.json()).resolves.toEqual({ error: "Necesitás permiso para editar el catálogo." });
    expect(response.status).toBe(403);
    expect(mockSave).not.toHaveBeenCalled();
  });

  test("stores the image for an admin user with catalog write permission", async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser);
    mockSave.mockResolvedValue({ url: "/uploads/product.png", pathname: "/app/public/uploads/product.png" });
    const file = new File([pngBytes], "product.png", { type: "image/png" });

    const response = await POST(uploadRequest(file));

    await expect(response.json()).resolves.toEqual({ url: "/uploads/product.png" });
    expect(response.status).toBe(201);
    expect(mockSave).toHaveBeenCalledOnce();
    expect(mockSave.mock.calls[0]?.[0]).toMatchObject({ name: file.name, size: file.size, type: file.type });
  });

  test("rejects spoofed image content before writing public files", async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser);
    const file = new File(["not-a-real-png"], "spoofed.png", { type: "image/png" });

    const response = await POST(uploadRequest(file));

    await expect(response.json()).resolves.toEqual({ error: "El contenido de la imagen no coincide con el tipo declarado." });
    expect(response.status).toBe(400);
    expect(mockSave).not.toHaveBeenCalled();
  });
});
