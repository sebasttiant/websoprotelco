import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockGetProductBySlug, mockGetProducts, mockGetSiteSettings, mockGetDocuments } = vi.hoisted(() => ({
  mockGetProductBySlug: vi.fn(),
  mockGetProducts: vi.fn(),
  mockGetSiteSettings: vi.fn(),
  mockGetDocuments: vi.fn(),
}));

vi.mock("@/domains/catalog", () => ({
  getProductBySlug: mockGetProductBySlug,
  getProducts: mockGetProducts,
}));

vi.mock("@/domains/settings", () => ({
  getSiteSettings: mockGetSiteSettings,
}));

vi.mock("@/domains/documents", () => ({
  getDocuments: mockGetDocuments,
  isSafeDocumentHref: (path: string) => path.startsWith("/documents/"),
}));

vi.mock("@/components/layout/header", () => ({ Header: () => null }));
vi.mock("@/components/layout/footer", () => ({ Footer: () => null }));

const { default: ProductPage } = await import("@/app/producto/[slug]/page");

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    slug: "fusionadora-x",
    sku: "FUS-01",
    name: "Fusionadora X",
    description: "Empalmes de fibra en campo.",
    priceCents: 1500000,
    promoPriceCents: null,
    isFeatured: false,
    currency: "COP",
    categoryName: "Fusionadoras",
    categorySlug: "fusionadoras",
    brand: "SP",
    imageUrl: null,
    inStock: true,
    ...overrides,
  };
}

async function renderPage(related: unknown[] = [], productOverrides: Record<string, unknown> = {}) {
  mockGetProductBySlug.mockResolvedValue(product(productOverrides));
  mockGetProducts.mockResolvedValue(related);
  mockGetSiteSettings.mockResolvedValue({ whatsappNumber: "+573001234567" });
  mockGetDocuments.mockResolvedValue({ documents: [], total: 0, page: 1, pageSize: 20 });
  render(await ProductPage({ params: Promise.resolve({ slug: "fusionadora-x" }) }));
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("ProductPage", () => {
  test("offers a WhatsApp enquiry prefilled with this product", async () => {
    await renderPage();

    const href = screen.getByRole("link", { name: /whatsapp/i }).getAttribute("href") ?? "";
    expect(new URL(href).searchParams.get("text")).toContain("Fusionadora X");
  });

  test("lets shoppers add the viewed product to the cart", async () => {
    await renderPage();

    expect(screen.getByRole("button", { name: "Agregar Fusionadora X al carrito" })).toBeInTheDocument();
  });

  test("shows IVA incluido under the product price", async () => {
    await renderPage();

    expect(screen.getByText("IVA incluido")).toBeInTheDocument();
  });

  test("offers a datasheet download when the product has a linked document", async () => {
    mockGetProductBySlug.mockResolvedValue(product());
    mockGetProducts.mockResolvedValue([]);
    mockGetSiteSettings.mockResolvedValue({ whatsappNumber: "+573001234567" });
    mockGetDocuments.mockResolvedValue({
      documents: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          title: "Ficha VFL",
          description: null,
          filePath: "/documents/datasheet/11111111-1111-4111-8111-111111111111_ficha.pdf",
          fileName: "ficha.pdf",
          fileSize: 1000,
          category: "datasheet",
          productId: "p1",
          productName: "Fusionadora X",
          uploadedBy: null,
          downloadCount: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    render(await ProductPage({ params: Promise.resolve({ slug: "fusionadora-x" }) }));

    expect(screen.getByRole("link", { name: "Descargar ficha técnica" })).toHaveAttribute(
      "href",
      "/documents/datasheet/11111111-1111-4111-8111-111111111111_ficha.pdf",
    );
  });

  test("offers the visible quote request link with the encoded product slug", async () => {
    await renderPage([], { slug: "fibra óptica" });

    expect(screen.getByRole("link", { name: "Solicitar cotización" })).toHaveAttribute(
      "href",
      "/contacto?producto=fibra%20%C3%B3ptica",
    );
  });

  test("looks for related products in the same category", async () => {
    await renderPage();

    expect(mockGetProducts).toHaveBeenCalledWith(
      expect.objectContaining({ categorySlug: "fusionadoras" }),
    );
  });

  test("lists related products, excluding the one being viewed", async () => {
    await renderPage([
      product({ id: "p1", slug: "fusionadora-x", name: "Fusionadora X" }),
      product({ id: "p2", slug: "fusionadora-y", name: "Fusionadora Y" }),
    ]);

    const related = screen.getByRole("region", { name: /relacionados/i });
    expect(within(related).getByText("Fusionadora Y")).toBeInTheDocument();
    expect(within(related).queryByText("Fusionadora X")).not.toBeInTheDocument();
  });

  test("omits the related section when the category holds nothing else", async () => {
    await renderPage([product({ id: "p1", slug: "fusionadora-x" })]);

    expect(screen.queryByRole("region", { name: /relacionados/i })).not.toBeInTheDocument();
  });
});
