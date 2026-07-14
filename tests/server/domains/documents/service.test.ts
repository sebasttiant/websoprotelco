// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockQuery, mockDeleteFile, mockCreateDocumentStorageAdapter } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockDeleteFile: vi.fn(),
  mockCreateDocumentStorageAdapter: vi.fn(),
}));

vi.mock("@/server/db/pool", () => ({
  query: mockQuery,
}));

vi.mock("@/server/storage", () => ({
  createDocumentStorageAdapter: mockCreateDocumentStorageAdapter,
}));

import {
  createDocument,
  deleteDocument,
  DOCUMENT_PAGE_SIZE,
  getDocument,
  getDocuments,
} from "@/domains/documents/service";

const documentId = "44444444-4444-4444-8444-444444444444";
const productId = "33333333-3333-4333-8333-333333333333";
const userId = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  vi.clearAllMocks();
});

describe("createDocument", () => {
  test("inserts a document bound to the uploading user", async () => {
    mockQuery.mockResolvedValue([]);

    await createDocument(
      {
        title: "Ficha Tecnica Router X",
        description: "Datasheet",
        filePath: "/documents/datasheet/uuid_router-x.pdf",
        fileName: "router-x.pdf",
        fileSize: 1024,
        category: "datasheet",
        productId,
      },
      userId,
    );

    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO documents");
    expect(values).toEqual([
      "Ficha Tecnica Router X",
      "Datasheet",
      "/documents/datasheet/uuid_router-x.pdf",
      "router-x.pdf",
      1024,
      "datasheet",
      productId,
      userId,
    ]);
  });

  test("defaults missing description, fileSize, and productId to null", async () => {
    mockQuery.mockResolvedValue([]);

    await createDocument(
      {
        title: "General manual",
        filePath: "/documents/manual/uuid_manual.pdf",
        fileName: "manual.pdf",
        category: "manual",
        productId: null,
      },
      null,
    );

    const [, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(values).toEqual([
      "General manual",
      null,
      "/documents/manual/uuid_manual.pdf",
      "manual.pdf",
      null,
      "manual",
      null,
      null,
    ]);
  });
});

describe("getDocuments", () => {
  test("maps document rows to camelCase and returns pagination metadata", async () => {
    mockQuery
      .mockResolvedValueOnce([
        {
          id: documentId,
          title: "Ficha Tecnica Router X",
          description: "Datasheet",
          file_path: "/documents/datasheet/uuid_router-x.pdf",
          file_name: "router-x.pdf",
          file_size: 1024,
          category: "datasheet",
          product_id: productId,
          product_name: "Fiber Router",
          uploaded_by: userId,
          download_count: 0,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([{ total: 1 }]);

    const result = await getDocuments({});

    expect(result).toEqual({
      documents: [
        {
          id: documentId,
          title: "Ficha Tecnica Router X",
          description: "Datasheet",
          filePath: "/documents/datasheet/uuid_router-x.pdf",
          fileName: "router-x.pdf",
          fileSize: 1024,
          category: "datasheet",
          productId,
          productName: "Fiber Router",
          uploadedBy: userId,
          downloadCount: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: DOCUMENT_PAGE_SIZE,
    });
  });

  test("clamps a non-positive page to page 1", async () => {
    mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

    const result = await getDocuments({}, -3);

    expect(result.page).toBe(1);
    const [, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(values).toEqual([DOCUMENT_PAGE_SIZE, 0]);
  });

  test("computes the offset for a later page and forwards category/product filters", async () => {
    mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

    await getDocuments({ category: "datasheet", productId }, 3);

    const [, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(values).toEqual(["datasheet", productId, DOCUMENT_PAGE_SIZE, DOCUMENT_PAGE_SIZE * 2]);
  });
});

describe("getDocument", () => {
  test("returns null when the document does not exist", async () => {
    mockQuery.mockResolvedValue([]);

    expect(await getDocument(documentId)).toBeNull();
  });

  test("returns the mapped document when it exists", async () => {
    mockQuery.mockResolvedValue([
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
        download_count: 2,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const result = await getDocument(documentId);

    expect(result).toEqual({
      id: documentId,
      title: "General manual",
      description: null,
      filePath: "/documents/manual/uuid_manual.pdf",
      fileName: "manual.pdf",
      fileSize: null,
      category: "manual",
      productId: null,
      productName: null,
      uploadedBy: null,
      downloadCount: 2,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });
});

describe("deleteDocument", () => {
  test("deletes the DB row and best-effort deletes the stored file when no other row references it", async () => {
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

    await deleteDocument(documentId);

    expect(mockQuery.mock.calls[1]?.[0]).toContain("DELETE FROM documents");
    expect(mockQuery.mock.calls[2]).toEqual([
      "SELECT COUNT(*)::int AS total FROM documents WHERE file_path = $1",
      ["/documents/manual/uuid_manual.pdf"],
    ]);
    expect(mockDeleteFile).toHaveBeenCalledWith("/documents/manual/uuid_manual.pdf");
  });

  test("does not unlink the file when another document row still references the same file_path", async () => {
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
      .mockResolvedValueOnce([{ total: 1 }]);

    await deleteDocument(documentId);

    expect(mockCreateDocumentStorageAdapter).not.toHaveBeenCalled();
    expect(mockDeleteFile).not.toHaveBeenCalled();
  });

  test("does nothing when the document does not exist", async () => {
    mockQuery.mockResolvedValueOnce([]);

    await deleteDocument(documentId);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockCreateDocumentStorageAdapter).not.toHaveBeenCalled();
  });

  test("does not throw when the storage adapter fails to delete the file", async () => {
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
    mockDeleteFile.mockRejectedValue(new Error("disk error"));

    await expect(deleteDocument(documentId)).resolves.toBeUndefined();
  });
});
