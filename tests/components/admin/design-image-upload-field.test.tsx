import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { DesignImageUploadField } from "@/components/admin/design-image-upload-field";

// A real design-image upload produces exactly this shape via the design storage adapter.
const SAFE = "/uploads/banners/3f2504e0-4f89-41d3-9a0c-0305e82c3301_banner.webp";

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

describe("DesignImageUploadField preview safety (regression)", () => {
  test("previews a safe adapter path", () => {
    render(<DesignImageUploadField name="imagePath" label="Imagen del banner" target="banners" defaultValue={SAFE} />);
    expect(screen.getByAltText(/vista previa de imagen del banner/i)).toBeInTheDocument();
    expect(screen.queryByText(/vista previa no disponible/i)).not.toBeInTheDocument();
  });

  test("falls back instead of handing a remote URL to next/image", () => {
    render(<DesignImageUploadField name="imagePath" label="Imagen del banner" target="banners" defaultValue="https://evil.example.com/x.png" />);
    expect(screen.queryByAltText(/vista previa/i)).not.toBeInTheDocument();
    expect(screen.getByText(/vista previa no disponible/i)).toBeInTheDocument();
  });

  test("falls back instead of handing a base64 data URI to next/image", () => {
    render(<DesignImageUploadField name="imagePath" label="Imagen del banner" target="banners" defaultValue="data:image/png;base64,AAAA" />);
    expect(screen.getByText(/vista previa no disponible/i)).toBeInTheDocument();
  });

  test("shows no preview area when blank", () => {
    render(<DesignImageUploadField name="imagePath" label="Imagen del banner" target="banners" defaultValue="" />);
    expect(screen.queryByText(/vista previa no disponible/i)).not.toBeInTheDocument();
    expect(screen.queryByAltText(/vista previa/i)).not.toBeInTheDocument();
  });

  test("keeps the hidden field so the form still submits the value", () => {
    const { container } = render(
      <DesignImageUploadField name="imagePath" label="Imagen del banner" target="banners" defaultValue={SAFE} />,
    );
    const hidden = container.querySelector('input[type="hidden"][name="imagePath"]');
    expect(hidden).toHaveValue(SAFE);
  });
});

describe("DesignImageUploadField upload failure presentation (Spanish)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("shows the localized API error when the upload is rejected", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue(
      fakeResponse({ error: "La imagen debe pesar 5MB o menos." }, false, 400),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <DesignImageUploadField name="imagePath" label="Imagen del banner" target="banners" defaultValue="" />,
    );

    const file = new File(["bytes"], "big.png", { type: "image/png" });
    await fireEvent.change(selectFileInput(container), { target: { files: [file] } });

    expect(await screen.findByText("La imagen debe pesar 5MB o menos.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("falls back to the Spanish generic message when the request itself fails", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <DesignImageUploadField name="imagePath" label="Imagen del banner" target="banners" defaultValue="" />,
    );

    const file = new File(["bytes"], "x.png", { type: "image/png" });
    await fireEvent.change(selectFileInput(container), { target: { files: [file] } });

    expect(await screen.findByText("No se pudo subir la imagen.")).toBeInTheDocument();
  });
});