// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockRedirect, mockRequirePermission, mockQuery, mockRevalidatePath, mockDeleteFile, mockCreateDocumentStorageAdapter } =
  vi.hoisted(() => ({
    mockRedirect: vi.fn((url: string) => {
      const error = new Error("NEXT_REDIRECT") as Error & { digest: string };
      error.digest = `NEXT_REDIRECT;replace;${url};307;`;
      throw error;
    }),
    mockRequirePermission: vi.fn(),
    mockQuery: vi.fn(),
    mockRevalidatePath: vi.fn(),
    mockDeleteFile: vi.fn(),
    mockCreateDocumentStorageAdapter: vi.fn(),
  }));

vi.mock("@/server/auth/guards", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/server/db/pool", () => ({
  query: mockQuery,
}));

vi.mock("@/server/storage", () => ({
  createDocumentStorageAdapter: mockCreateDocumentStorageAdapter,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { createDocument, deleteDocument } from "@/domains/documents/actions";

const adminId = "11111111-1111-4111-8111-111111111111";
const documentId = "44444444-4444-4444-8444-444444444444";
const productId = "33333333-3333-4333-8333-333333333333";

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();

  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }

  return data;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("createDocument", () => {
  test("requires the documents:write permission before writing", async () => {
    mockRequirePermission.mockResolvedValue({ id: adminId, email: "admin@soprotelco.test", role: "admin" });
    mockQuery.mockResolvedValue([]);

    await expect(
      createDocument(
        formData({
          title: "Ficha Tecnica Router X",
          filePath: "/documents/datasheet/3b2c1a4e-0000-4000-8000-000000000000_router-x.pdf",
          fileName: "router-x.pdf",
          category: "datasheet",
          productId,
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRequirePermission).toHaveBeenCalledWith("documents:write");
    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO documents");
    expect(values).toEqual([
      "Ficha Tecnica Router X",
      null,
      "/documents/datasheet/3b2c1a4e-0000-4000-8000-000000000000_router-x.pdf",
      "router-x.pdf",
      null,
      "datasheet",
      productId,
      adminId,
    ]);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/documents");
    expect(mockRedirect).toHaveBeenCalledWith("/admin/documents?success=document-created");
  });

  test("checks the permission before parsing input", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await expect(
      createDocument(formData({ title: "", filePath: "", fileName: "", category: "manual" })),
    ).rejects.toThrow("forbidden");

    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("returns a validation error for a missing title and never writes", async () => {
    mockRequirePermission.mockResolvedValue({ id: adminId, email: "admin@soprotelco.test", role: "admin" });

    const result = await createDocument(
      formData({ title: "", filePath: "/documents/manual/uuid_x.pdf", fileName: "x.pdf", category: "manual" }),
    );

    expect(result.success).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe("deleteDocument", () => {
  test("requires the documents:write permission and deletes the document", async () => {
    mockRequirePermission.mockResolvedValue({ id: adminId, email: "admin@soprotelco.test", role: "admin" });
    mockQuery
      .mockResolvedValueOnce([
        {
          id: documentId,
          title: "General manual",
          description: null,
          file_path: "/documents/manual/uuid_manual.pdf",
          file_name: "manual.pdf",
          file_size: null,
          category: "manual",
          product_id: null,
          product_name: null,
          uploaded_by: null,
          download_count: 0,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);
    mockCreateDocumentStorageAdapter.mockResolvedValue({ deleteFile: mockDeleteFile });
    mockDeleteFile.mockResolvedValue(undefined);

    await expect(deleteDocument(formData({ id: documentId }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRequirePermission).toHaveBeenCalledWith("documents:write");
    expect(mockQuery.mock.calls[1]?.[0]).toContain("DELETE FROM documents");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/documents");
    expect(mockRedirect).toHaveBeenCalledWith("/admin/documents?success=document-deleted");
  });

  test("checks the permission before parsing input", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));

    await expect(deleteDocument(formData({ id: "not-a-uuid" }))).rejects.toThrow("forbidden");

    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("returns a validation error for a non-uuid id and never deletes", async () => {
    mockRequirePermission.mockResolvedValue({ id: adminId, email: "admin@soprotelco.test", role: "admin" });

    const result = await deleteDocument(formData({ id: "not-a-uuid" }));

    expect(result.success).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
