import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ImageUploadField } from "@/components/admin/image-upload-field";

const SAFE = "/uploads/2026-03-08-3f2504e0-4f89-41d3-9a0c-0305e82c3301.webp";

describe("ImageUploadField preview safety", () => {
  test("previews a safe adapter path", () => {
    render(<ImageUploadField name="imageUrl" label="Imagen de producto" defaultValue={SAFE} />);
    expect(screen.getByAltText(/vista previa de imagen de producto/i)).toBeInTheDocument();
    expect(screen.queryByText(/vista previa no disponible/i)).not.toBeInTheDocument();
  });

  test("refuses to hand a remote URL to next/image and shows a fallback", () => {
    render(<ImageUploadField name="imageUrl" label="Imagen de producto" defaultValue="https://evil.example.com/x.png" />);
    expect(screen.queryByAltText(/vista previa/i)).not.toBeInTheDocument();
    expect(screen.getByText(/vista previa no disponible/i)).toBeInTheDocument();
  });

  test("refuses a base64 data URI", () => {
    render(<ImageUploadField name="imageUrl" label="Imagen de producto" defaultValue="data:image/png;base64,AAAA" />);
    expect(screen.getByText(/vista previa no disponible/i)).toBeInTheDocument();
  });

  test("shows no preview area when blank", () => {
    render(<ImageUploadField name="imageUrl" label="Imagen de producto" defaultValue="" />);
    expect(screen.queryByText(/vista previa no disponible/i)).not.toBeInTheDocument();
    expect(screen.queryByAltText(/vista previa/i)).not.toBeInTheDocument();
  });

  test("keeps the hidden field so the form still submits the value", () => {
    const { container } = render(
      <ImageUploadField name="imageUrl" label="Imagen de producto" defaultValue={SAFE} />,
    );
    const hidden = container.querySelector('input[type="hidden"][name="imageUrl"]');
    expect(hidden).toHaveValue(SAFE);
  });
});

describe("ImageUploadField upload failure presentation (Spanish)", () => {
  function fakeResponse(body: unknown, ok: boolean, status: number): Response {
    return { ok, status, json: async () => body } as unknown as Response;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("shows the localized API error when the upload is rejected", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue(
      fakeResponse({ error: "Solo se admiten imágenes JPG, PNG y WebP." }, false, 400),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<ImageUploadField name="imageUrl" label="Imagen de producto" defaultValue="" />);
    const file = new File(["bytes"], "bad.svg", { type: "image/svg+xml" });

    await fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [file] },
    });

    expect(await screen.findByText("Solo se admiten imágenes JPG, PNG y WebP.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("falls back to the Spanish generic message when the request itself fails", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<ImageUploadField name="imageUrl" label="Imagen de producto" defaultValue="" />);
    const file = new File(["bytes"], "x.png", { type: "image/png" });

    await fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [file] },
    });

    expect(await screen.findByText("No se pudo subir la imagen.")).toBeInTheDocument();
  });
});
