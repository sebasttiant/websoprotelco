// Public surface of the catalog domain. Consumers (storefront pages, admin pages,
// components) must import from here rather than reaching into ./schemas, ./repository,
// ./service, or ./actions directly.

export type {
  CatalogDeleteInput,
  CategoryAdminDetail,
  CategoryAdminInput,
  CategoryAdminSummary,
  CategoryOption,
  CategorySummary,
  ProductAdminDetail,
  ProductAdminInput,
  ProductAdminListFilters,
  ProductAdminListResult,
  ProductAdminSummary,
  ProductCatalogPage,
  ProductDetail,
  ProductListFilters,
  ProductSort,
  ProductSummary,
} from "./schemas";

export {
  CATALOG_PAGE_SIZE,
  getDiscountPercent,
  getEffectivePriceCents,
  getSafeCatalogImageUrl,
  isSafeCatalogImagePath,
} from "./schemas";

export {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  importProductsCsv,
  updateCategory,
  updateProduct,
  type AdminActionState,
} from "./actions";

export {
  countAllProducts,
  getCategories,
  getCategoriesForAdmin,
  getCategoryByIdForAdmin,
  getCategoryOptions,
  getCategoryOptionsExcluding,
  getFeaturedProducts,
  getProductByIdForAdmin,
  getPromotedProducts,
  getProductBySlug,
  getProductCatalog,
  getProducts,
  getProductsForAdmin,
  listPublicProductPaths,
} from "./service";
