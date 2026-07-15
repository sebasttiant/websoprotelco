// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

import type { SessionUser } from "@/server/auth/session";

const { mockGetCurrentUser, mockSaveDesignImage } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockSaveDesignImage: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/server/storage/local", () => ({
  createLocalStorageAdapter: () => ({
    saveDesignImage: mockSaveDesignImage,
  }),
}));

import { POST } from "@/app/api/design/upload/route";

const adminUser: SessionUser = { id: "admin-1", email: "admin@soprotelco.test", role: "admin" };
const staffUser: SessionUser = { id: "staff-1", email: "staff@soprotelco.test", role: "staff" };
const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function uploadRequest(file: File, target?: string): Request {
  const formData = new FormData();
  formData.set("file", file);
  if (target !== undefined) {
    formData.set("target", target);
  }

  return new Request("http://localhost:8585/api/design/upload", {
    method: "POST",
    body: formData,
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/design/upload", () => {
  test("returns 401 when the request has no authenticated user", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const request = uploadRequest(new File([pngBytes], "banner.png", { type: "image/png" }));

    const response = await POST(request);

    await expect(response.json()).resolves.toEqual({ error: "Se requiere iniciar sesión." });
    expect(response.status).toBe(401);
    expect(mockSaveDesignImage).not.toHaveBeenCalled();
  });

  test("returns 403 when the authenticated role cannot edit the design", async () => {
    mockGetCurrentUser.mockResolvedValue(staffUser);
    const request = uploadRequest(new File([pngBytes], "banner.png", { type: "image/png" }));

    const response = await POST(request);

    await expect(response.json()).resolves.toEqual({ error: "Necesitás permiso para editar el diseño." });
    expect(response.status).toBe(403);
    expect(mockSaveDesignImage).not.toHaveBeenCalled();
  });

  test("returns 400 for invalid image content before writing public files", async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser);
    const file = new File(["not-a-real-png"], "spoofed.png", { type: "image/png" });

    const response = await POST(uploadRequest(file));

    await expect(response.json()).resolves.toEqual({
      error: "El contenido de la imagen no coincide con el tipo declarado.",
    });
    expect(response.status).toBe(400);
    expect(mockSaveDesignImage).not.toHaveBeenCalled();
  });

  test("stores the hero image for an admin user with design:write permission", async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser);
    mockSaveDesignImage.mockResolvedValue({
      url: "/design/hero/uuid_hero.png",
      pathname: "/app/public/design/hero/uuid_hero.png",
    });
    const file = new File([pngBytes], "hero.png", { type: "image/png" });

    const response = await POST(uploadRequest(file, "hero"));

    await expect(response.json()).resolves.toEqual({ url: "/design/hero/uuid_hero.png" });
    expect(response.status).toBe(201);
    expect(mockSaveDesignImage).toHaveBeenCalledOnce();
    expect(mockSaveDesignImage.mock.calls[0]?.[1]).toBe("hero");
  });

  test("defaults the target to banners when the field is omitted", async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser);
    mockSaveDesignImage.mockResolvedValue({
      url: "/design/banners/uuid_banner.png",
      pathname: "/app/public/design/banners/uuid_banner.png",
    });
    const file = new File([pngBytes], "banner.png", { type: "image/png" });

    const response = await POST(uploadRequest(file));

    await expect(response.json()).resolves.toEqual({ url: "/design/banners/uuid_banner.png" });
    expect(response.status).toBe(201);
    expect(mockSaveDesignImage).toHaveBeenCalledOnce();
    expect(mockSaveDesignImage.mock.calls[0]?.[1]).toBe("banners");
  });
});