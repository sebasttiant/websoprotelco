// @vitest-environment node
import { describe, expect, test } from "vitest";

import { MAX_DOCUMENT_SIZE_BYTES, validateDocumentFile } from "@/server/storage";
import { sanitizeDocumentCategory, sanitizeDocumentFilename } from "@/server/storage/local";

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

describe("validateDocumentFile", () => {
  test("accepts a valid PDF under the size limit", async () => {
    const file = new File([PDF_BYTES], "datasheet.pdf", { type: "application/pdf" });

    await expect(validateDocumentFile(file)).resolves.toEqual({ valid: true });
  });

  test("rejects a missing file", async () => {
    await expect(validateDocumentFile(null)).resolves.toEqual({
      valid: false,
      error: "Tenés que subir un documento.",
    });
  });

  test("rejects an empty file", async () => {
    const file = new File([], "empty.pdf", { type: "application/pdf" });

    await expect(validateDocumentFile(file)).resolves.toEqual({
      valid: false,
      error: "Tenés que subir un documento.",
    });
  });

  test("rejects a non-PDF MIME type", async () => {
    const file = new File(["not a pdf"], "notes.txt", { type: "text/plain" });

    await expect(validateDocumentFile(file)).resolves.toEqual({
      valid: false,
      error: "Solo se admiten documentos PDF.",
    });
  });

  test("rejects a document larger than 10MB", async () => {
    const file = new File([new Uint8Array(MAX_DOCUMENT_SIZE_BYTES + 1)], "large.pdf", {
      type: "application/pdf",
    });

    await expect(validateDocumentFile(file)).resolves.toEqual({
      valid: false,
      error: "El documento debe pesar 10MB o menos.",
    });
  });

  test("rejects a file with the PDF MIME type but wrong magic bytes", async () => {
    const file = new File(["definitely-not-a-pdf"], "spoofed.pdf", { type: "application/pdf" });

    await expect(validateDocumentFile(file)).resolves.toEqual({
      valid: false,
      error: "El contenido del documento no coincide con el tipo declarado.",
    });
  });
});

describe("sanitizeDocumentFilename", () => {
  test("strips directory traversal segments using forward slashes", () => {
    expect(sanitizeDocumentFilename("../../../etc/passwd")).toBe("passwd.pdf");
  });

  test("strips directory traversal segments using backslashes", () => {
    expect(sanitizeDocumentFilename("..\\..\\x.pdf")).toBe("x.pdf");
  });

  test("strips an absolute path prefix", () => {
    expect(sanitizeDocumentFilename("/etc/passwd")).toBe("passwd.pdf");
  });

  test("mixes slashes and backslashes in a traversal attempt", () => {
    expect(sanitizeDocumentFilename("..\\../..\\/etc/shadow")).toBe("shadow.pdf");
  });

  test("replaces unsafe characters with underscores", () => {
    expect(sanitizeDocumentFilename("weird name!@#$.pdf")).toBe("weird_name_.pdf");
  });

  test("strips leading dots to avoid hidden files", () => {
    expect(sanitizeDocumentFilename("...hidden.pdf")).toBe("hidden.pdf");
  });

  test("forces the .pdf extension regardless of the original extension", () => {
    expect(sanitizeDocumentFilename("report.exe")).toBe("report.pdf");
  });

  test("truncates an excessively long filename", () => {
    const longName = `${"a".repeat(300)}.pdf`;

    const result = sanitizeDocumentFilename(longName);

    expect(result).toBe(`${"a".repeat(100)}.pdf`);
  });

  test("falls back to a default name when nothing safe remains", () => {
    expect(sanitizeDocumentFilename("....")).toBe("document.pdf");
  });

  test("keeps a normal filename intact aside from forcing the extension", () => {
    expect(sanitizeDocumentFilename("Ficha-Tecnica_Router-X.pdf")).toBe("Ficha-Tecnica_Router-X.pdf");
  });
});

describe("sanitizeDocumentCategory", () => {
  test.each(["manual", "datasheet", "certificate", "warranty", "other"])(
    "accepts the allowed category %s",
    (category) => {
      expect(sanitizeDocumentCategory(category)).toBe(category);
    },
  );

  test("falls back to other for an unknown category", () => {
    expect(sanitizeDocumentCategory("../../etc")).toBe("other");
  });

  test("falls back to other for an empty category", () => {
    expect(sanitizeDocumentCategory("")).toBe("other");
  });
});
