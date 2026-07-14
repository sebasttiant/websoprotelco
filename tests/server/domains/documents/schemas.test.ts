// @vitest-environment node
import { describe, expect, test } from "vitest";

import {
  documentCreateInputSchema,
  documentDeleteInputSchema,
  isDocumentCategory,
  isSafeDocumentHref,
} from "@/domains/documents/schemas";

const productId = "33333333-3333-4333-8333-333333333333";

// Shaped like what `saveDocument` (src/server/storage/local.ts) actually produces:
// `/documents/<category>/<uuid>_<sanitized-filename>.pdf`.
const validFilePath = "/documents/datasheet/3b2c1a4e-0000-4000-8000-000000000000_router-x.pdf";
const validManualFilePath = "/documents/manual/3b2c1a4e-0000-4000-8000-000000000001_manual.pdf";
const validOtherFilePath = "/documents/other/3b2c1a4e-0000-4000-8000-000000000002_file.pdf";

describe("isDocumentCategory", () => {
  test.each(["manual", "datasheet", "certificate", "warranty", "other"])("accepts %s", (value) => {
    expect(isDocumentCategory(value)).toBe(true);
  });

  test.each(["brochure", "", "MANUAL"])("rejects %s", (value) => {
    expect(isDocumentCategory(value)).toBe(false);
  });
});

describe("documentCreateInputSchema", () => {
  test("accepts a full valid payload", () => {
    const result = documentCreateInputSchema.safeParse({
      title: "Ficha Tecnica Router X",
      description: "Technical datasheet for the Router X model.",
      filePath: validFilePath,
      fileName: "router-x.pdf",
      fileSize: 102400,
      category: "datasheet",
      productId,
    });

    expect(result.success).toBe(true);
  });

  test("accepts a payload without description, fileSize, or productId", () => {
    const result = documentCreateInputSchema.safeParse({
      title: "General manual",
      filePath: validManualFilePath,
      fileName: "manual.pdf",
      category: "manual",
    });

    expect(result.success).toBe(true);
  });

  test("rejects a missing title", () => {
    const result = documentCreateInputSchema.safeParse({
      title: "",
      filePath: validOtherFilePath,
      fileName: "file.pdf",
      category: "other",
    });

    expect(result.success).toBe(false);
  });

  test("rejects a title longer than 300 characters", () => {
    const result = documentCreateInputSchema.safeParse({
      title: "x".repeat(301),
      filePath: validOtherFilePath,
      fileName: "file.pdf",
      category: "other",
    });

    expect(result.success).toBe(false);
  });

  test("rejects an unknown category", () => {
    const result = documentCreateInputSchema.safeParse({
      title: "Warranty card",
      filePath: validOtherFilePath,
      fileName: "file.pdf",
      category: "brochure",
    });

    expect(result.success).toBe(false);
  });

  test("rejects a fileSize above the 10MB limit", () => {
    const result = documentCreateInputSchema.safeParse({
      title: "Big file",
      filePath: validOtherFilePath,
      fileName: "file.pdf",
      fileSize: 10 * 1024 * 1024 + 1,
      category: "other",
    });

    expect(result.success).toBe(false);
  });

  test.each([
    "javascript:alert(1)",
    "//evil.example.com/x",
    "http://evil.com/x.pdf",
    "/etc/passwd",
    "../../x.pdf",
    "/documents/manual/x.pdf", // missing the required uuid_ prefix
  ])("rejects an unsafe or malformed filePath: %s", (filePath) => {
    const result = documentCreateInputSchema.safeParse({
      title: "General manual",
      filePath,
      fileName: "manual.pdf",
      category: "manual",
    });

    expect(result.success).toBe(false);
  });

  test("accepts a filePath matching the exact shape produced by the storage adapter", () => {
    const result = documentCreateInputSchema.safeParse({
      title: "General manual",
      filePath: "/documents/manual/3b2c1a4e-0000-4000-8000-000000000000_ficha.pdf",
      fileName: "ficha.pdf",
      category: "manual",
    });

    expect(result.success).toBe(true);
  });

  test.each(["file\r\n.pdf", "line\nbreak.pdf", "carriage\rreturn.pdf"])(
    "rejects a fileName containing line breaks: %s",
    (fileName) => {
      const result = documentCreateInputSchema.safeParse({
        title: "General manual",
        filePath: validManualFilePath,
        fileName,
        category: "manual",
      });

      expect(result.success).toBe(false);
    },
  );

  test("treats a blank productId as no product association", () => {
    const result = documentCreateInputSchema.safeParse({
      title: "General manual",
      filePath: validManualFilePath,
      fileName: "manual.pdf",
      category: "manual",
      productId: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.productId).toBeNull();
    }
  });

  test("rejects a non-uuid productId", () => {
    const result = documentCreateInputSchema.safeParse({
      title: "General manual",
      filePath: validManualFilePath,
      fileName: "manual.pdf",
      category: "manual",
      productId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });
});

describe("documentDeleteInputSchema", () => {
  test("accepts a valid uuid", () => {
    expect(documentDeleteInputSchema.safeParse({ id: productId }).success).toBe(true);
  });

  test("rejects a non-uuid id", () => {
    expect(documentDeleteInputSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false);
  });
});

describe("isSafeDocumentHref", () => {
  test("accepts a real path produced by the storage adapter", () => {
    expect(isSafeDocumentHref(validFilePath)).toBe(true);
  });

  test.each([
    "javascript:alert(document.domain)",
    "//evil.example.com/x",
    "http://evil.com/x.pdf",
    "/etc/passwd",
    "../../x.pdf",
    "/documents/manual/x.pdf",
  ])("rejects an unsafe or malformed path: %s", (path) => {
    expect(isSafeDocumentHref(path)).toBe(false);
  });
});
