import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const { mockGetCategories, mockGetProducts, mockGetProductCatalog, mockGetProductBySlug, mockNotFound } = vi.hoisted(() => ({
  mockGetCategories: vi.fn(),
  mockGetProducts: vi.fn(),
  mockGetProductCatalog: vi.fn(),
  mockGetProductBySlug: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("@/domains/catalog", () => ({
  getCategories: mockGetCategories,
  getProducts: mockGetProducts,
  getProductCatalog: mockGetProductCatalog,
  getProductBySlug: mockGetProductBySlug,
}));

vi.mock("@/domains/settings", () => ({
  getSiteSettings: vi.fn().mockResolvedValue({ whatsappNumber: "+573001234567" }),
}));

vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
  usePathname: () => "/productos",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/layout/header", () => ({ Header: () => null }));
vi.mock("@/components/layout/footer", () => ({ Footer: () => null }));

const { default: CatalogPage } = await import("@/app/productos/page");
const { default: CategoryPage } = await import("@/app/productos/[category]/page");
const { default: ProductPage } = await import("@/app/producto/[slug]/page");
const { ProductCard } = await import("@/components/catalog/product-card");
const { default: ProductNotFound } = await import("@/app/producto/[slug]/not-found");

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

afterEach(() => {
  vi.clearAllMocks();
});

describe("storefront catalog routes", () => {
  test("shows browsable catalog products and Spanish filters", async () => {
    mockGetCategories.mockResolvedValue([{ id: "c1", slug: "fusionadoras", name: "Fusionadoras", imageUrl: null }]);
    mockGetProductCatalog.mockResolvedValue({ products: [product()], total: 1, page: 1, pageSize: 24, brands: [] });

    render(await CatalogPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "Nuestros Productos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fusionadora X" })).toHaveAttribute("href", "/producto/fusionadora-x");
    expect(screen.getByRole("link", { name: "Cotizar" })).toHaveAttribute("href", "/contacto?producto=fusionadora-x");
    expect(screen.getByRole("navigation", { name: "Ruta de navegación" })).toBeInTheDocument();
    expect(screen.getByLabelText("Categoría")).toHaveValue("");
    expect(screen.queryByText(/PostgreSQL/)).not.toBeInTheDocument();
    expect(screen.getByText("Precios en pesos colombianos")).toBeInTheDocument();
  });

  test("shows an empty category with a catalog return link and accessible breadcrumb", async () => {
    mockGetCategories.mockResolvedValue([{ id: "c1", slug: "fusionadoras", name: "Fusionadoras", imageUrl: null }]);
    mockGetProductCatalog.mockResolvedValue({ products: [], total: 0, page: 1, pageSize: 24, brands: [] });

    render(await CategoryPage({ params: Promise.resolve({ category: "fusionadoras" }), searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "Fusionadoras" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No encontramos productos" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Ruta de navegación" })).toHaveTextContent("Catálogo");
    expect(screen.getByRole("link", { name: "Volver al catálogo" })).toHaveAttribute("href", "/productos");
  });

  test("returns not-found for an unknown product", async () => {
    mockGetProductBySlug.mockResolvedValue(null);

    await expect(ProductPage({ params: Promise.resolve({ slug: "desconocido" }) })).rejects.toThrow("NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalledOnce();
  });

  test("uses the branded placeholder when a product has no approved image", () => {
    render(<ProductCard product={product()} />);

    expect(screen.getByRole("img", { name: /imagen pendiente de fusionadora x/i })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Fusionadora X" })).not.toBeInTheDocument();
  });

  test("does not render an image element for an unsafe stored value", () => {
    render(<ProductCard product={product({ imageUrl: "https://remote.invalid/catalog.png" })} />);

    expect(screen.getByRole("img", { name: /imagen pendiente de fusionadora x/i })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Fusionadora X" })).not.toBeInTheDocument();
  });

  test("uses the Spanish product not-found boundary", () => {
    render(<ProductNotFound />);

    expect(screen.getByRole("heading", { name: "No encontramos este producto" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al catálogo" })).toHaveAttribute("href", "/productos");
  });
});
