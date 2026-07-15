import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { DocumentUploadField } from "@/components/admin/document-upload-field";

function fakeResponse(body: unknown, ok: boolean, status: number): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

function selectFileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"]');
  if (!input) {
    throw new Error("File input not rendered");
  }
  return input as HTMLInputElement;
}

describe("DocumentUploadField upload failure presentation (Spanish)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("shows the localized API error when the upload is rejected", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue(
      fakeResponse({ error: "El documento debe pesar 10MB o menos." }, false, 413),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<DocumentUploadField label="Ficha técnica" />);
    const file = new File(["bytes"], "huge.pdf", { type: "application/pdf" });

    await fireEvent.change(selectFileInput(container), { target: { files: [file] } });

    expect(await screen.findByText("El documento debe pesar 10MB o menos.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("shows the localized spoofed-content error from the validator", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue(
      fakeResponse({ error: "El contenido del documento no coincide con el tipo declarado." }, false, 400),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<DocumentUploadField label="Ficha técnica" />);
    const file = new File(["not-a-pdf"], "fake.pdf", { type: "application/pdf" });

    await fireEvent.change(selectFileInput(container), { target: { files: [file] } });

    expect(await screen.findByText("El contenido del documento no coincide con el tipo declarado.")).toBeInTheDocument();
  });

  test("falls back to the Spanish generic message when the request itself fails", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<DocumentUploadField label="Ficha técnica" />);
    const file = new File(["bytes"], "x.pdf", { type: "application/pdf" });

    await fireEvent.change(selectFileInput(container), { target: { files: [file] } });

    expect(await screen.findByText("No se pudo subir el documento.")).toBeInTheDocument();
  });
});